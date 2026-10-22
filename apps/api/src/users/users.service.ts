import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clerkClient } from '../auth/clerk.client';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PaginationDto } from '../common/decorators/pagination.dto';
import {
  decodeCursor,
  buildPaginatedResponse,
} from '../common/utils/pagination.helper';
import { Prisma } from '../generated/prisma/client';
import { StorageService } from '../storage/storage.service';

// Clerk API errors carry a list of { code, longMessage }. Translates the ones a
// username update can produce into HTTP errors; rethrows anything else.
function rethrowClerkUsernameError(e: unknown): never {
  const errors = (e as { errors?: { code?: string; longMessage?: string }[] })
    ?.errors;
  if (errors?.some((error) => error.code === 'form_identifier_exists')) {
    throw new ConflictException('Username already in use');
  }
  const invalid = errors?.find((error) => error.code?.startsWith('form_'));
  if (invalid) {
    throw new BadRequestException(invalid.longMessage ?? 'Invalid username');
  }
  throw e;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  // Usernames are stored lowercase, so lowercasing the input makes lookups
  // case-insensitive and lets them use the unique index.
  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
  }

  async isUsernameAvailable(username: string) {
    const existing = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      select: { id: true },
    });
    return !existing;
  }

  async create(data: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  // Completes onboarding. The user.created webhook normally creates the row
  // first with a null username; the upsert also covers the webhook arriving
  // late (or never, in local dev without a tunnel) without creating a
  // duplicate, since the Clerk ID is the primary key.
  async createProfile(id: string, data: CreateProfileDto) {
    // Get trusted account information from Clerk.
    const clerkUser = await clerkClient.users.getUser(id);

    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );
    const username = data.username.trim().toLowerCase();

    try {
      // The username is also set on Clerk so people can sign in with it. Doing
      // that inside the transaction rolls back our row if Clerk rejects it.
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { id },
          create: {
            id,
            email: primaryEmail?.emailAddress ?? null,
            firstName: data.firstName,
            lastName: data.lastName,
            username,
            avatarUrl: clerkUser.imageUrl || null,
          },
          update: {
            firstName: data.firstName,
            lastName: data.lastName,
            username,
          },
        });
        await clerkClient.users
          .updateUser(id, { username })
          .catch(rethrowClerkUsernameError);
        return user;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Username already in use');
      }

      throw e;
    }
  }

  async update(id: string, data: UpdateMeDto) {
    const username = data.username?.trim().toLowerCase();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: { ...data, ...(username === undefined ? {} : { username }) },
        });
        // Keep Clerk's copy (used for sign-in) in step; see createProfile.
        if (username !== undefined) {
          await clerkClient.users
            .updateUser(id, { username })
            .catch(rethrowClerkUsernameError);
        }
        return user;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException('Username already in use');
        }

        if (e.code === 'P2025') {
          throw new NotFoundException('User not found');
        }
      }

      throw e;
    }
  }

  async deleteAccount(id: string) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const media = await this.prisma.postMedia.findMany({
      where: { post: { trip: { ownerId: id } } },
      select: { s3Key: true },
    });

    // Keep the database rows (and their S3 keys) available if S3 deletion
    // fails. Retrying is safe because S3 object deletion is idempotent.
    await this.storage.deleteObjectsStrict(media.map((item) => item.s3Key));

    // Then delete Clerk and rely on foreign-key cascades for the user's trips,
    // posts, media rows, and follows.
    await clerkClient.users.deleteUser(id);

    // Then delete the local database record. If this fails, Clerk's
    // user.deleted webhook removes the row as well.
    await this.prisma.user.deleteMany({
      where: { id },
    });
  }

  async listUsers(pagination: PaginationDto) {
    const { cursor, limit = 20 } = pagination;

    const where = cursor
      ? {
          id: {
            gt: decodeCursor(cursor),
          },
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      orderBy: {
        id: 'asc',
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, -1) : users;

    return buildPaginatedResponse(items, hasMore, (user) => user.id);
  }
}
