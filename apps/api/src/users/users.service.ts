import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { clerkClient } from '../auth/clerk.client';
import { UpdateMeDto } from './dto/update-me.dto';
import { CreateProfileDto } from './dto/create-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
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
    try {
      return await this.prisma.user.create({
        data,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException('Username already in use');
        }
      }
      throw e;
    }
  }

  async createProfile(id: string, data: CreateProfileDto) {
    // Don't allow the same account to create multiple profiles.
    const existingUser = await this.findById(id);

    if (existingUser) {
      throw new ConflictException('Profile already exists');
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
    try {
      return await this.prisma.user.update({ where: { id }, data });
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
    if (!user) throw new NotFoundException('User not found');

    await clerkClient.users.deleteUser(id); // delete in Clerk first
    await this.prisma.user.deleteMany({ where: { id } }); // then locally
  }
}
