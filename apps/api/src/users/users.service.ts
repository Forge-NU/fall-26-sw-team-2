import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { clerkClient } from '../auth/clerk.client';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { PaginationDto } from '../common/decorators/pagination.dto';
import { decodeCursor, buildPaginatedResponse } from '../common/utils/pagination.helper';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findFirstOrThrow({
      where: { id },
    });
  }

  async create(data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl?: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  async createProfile(id: string, data: CreateProfileDto) {
    // Don't allow the same account to create multiple profiles.
    // Prisma P2025 will be thrown if user already exists, handled by global filter
    try {
      await this.findById(id);
      throw new ConflictException('Profile already exists');
    } catch (error) {
      // If it's P2025 (not found), that's expected - continue to create
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // User doesn't exist, proceed with creation
      } else if (error instanceof ConflictException) {
        throw error;
      } else {
        throw error;
      }
    }

    // Get trusted account information from Clerk.
    const clerkUser = await clerkClient.users.getUser(id);

    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    );

    if (!primaryEmail) {
      throw new ConflictException(
        'A primary email address is required to create a profile',
      );
    }

    // Save the profile in our local database.
    return this.create({
      id,
      email: primaryEmail.emailAddress,
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      avatarUrl: clerkUser.imageUrl || undefined,
    });
  }

  async update(id: string, data: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
  async deleteAccount(id: string) {
    // Prisma P2025 will be thrown if user doesn't exist, handled by global filter
    await clerkClient.users.deleteUser(id); // delete in Clerk first
    await this.prisma.user.deleteMany({ where: { id } }); // then locally
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
      take: limit + 1, // Fetch one extra to determine if there's a next page
      orderBy: {
        id: 'asc',
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, -1) : users;

    return buildPaginatedResponse(items, hasMore, (user) => user.id);
  }
}
