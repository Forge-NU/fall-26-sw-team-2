import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { clerkClient } from '../auth/clerk.client';
import { UpdateMeDto } from './dto/update-me.dto';

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
    return this.prisma.user.create({
      data,
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
