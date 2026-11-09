import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findUserMediaKeys } from './user-media';
import { clerkClient } from '../auth/clerk.client';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PaginationDto } from '../common/decorators/pagination.dto';
import {
  decodeCursor,
  buildPaginatedResponse,
} from '../common/utils/pagination.helper';
import { Prisma } from '../generated/prisma/client';
import { deleteUserRows, DELETE_USER_TX_OPTIONS } from './delete-user-rows';
import { StorageService } from '../storage/storage.service';
import { isOwnAvatarKey } from '../common/avatar';

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

  async update(id: string, { avatarKey, ...data }: UpdateMeDto) {
    if (avatarKey != null && !isOwnAvatarKey(avatarKey, id)) {
      throw new BadRequestException(
        'avatarKey must be one of your avatar uploads',
      );
    }
    const username = data.username?.trim().toLowerCase();
    const previous =
      avatarKey === undefined
        ? null
        : await this.prisma.user.findUnique({
            where: { id },
            select: { avatarUrl: true },
          });

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: {
            ...data,
            ...(username === undefined ? {} : { username }),
            // The column keeps its name; it now holds the key (see common/avatar.ts)
            ...(avatarKey === undefined ? {} : { avatarUrl: avatarKey }),
          },
        });
        // Keep Clerk's copy (used for sign-in) in step; see createProfile.
        if (username !== undefined) {
          await clerkClient.users
            .updateUser(id, { username })
            .catch(rethrowClerkUsernameError);
        }
        return user;
      });
      // The replaced photo isn't shown anywhere any more. If this fails, account
      // deletion's users/{id}/ prefix delete still removes it.
      const old = previous?.avatarUrl;
      if (old && old !== user.avatarUrl && isOwnAvatarKey(old, id)) {
        await this.storage.deleteObjects([old]);
      }
      return user;
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

    const keys = await findUserMediaKeys(this.prisma, this.storage, id);

    // Keep the database rows (and their S3 keys) available if S3 deletion
    // fails. Retrying is safe because S3 object deletion is idempotent.
    await this.storage.deleteObjectsStrict(keys);

    // Then delete the local rows (recomputing the places their posts rated)
    // and Clerk in one transaction. Clerk is deleted last, inside the
    // transaction: if anything local fails, Clerk is never called, and if
    // Clerk fails, the local delete rolls back.
    await this.prisma.$transaction(async (tx) => {
      await deleteUserRows(tx, id);
      await clerkClient.users.deleteUser(id);
    }, DELETE_USER_TX_OPTIONS);
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
