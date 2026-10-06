import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
