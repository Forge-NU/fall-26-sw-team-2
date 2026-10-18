import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FollowListQueryDto } from './dto/follow-list-query.dto';
import type {
  FollowCounts,
  FollowListPage,
  FollowStatus,
} from './follow-list.types';
import { Prisma } from '../generated/prisma/client';
import { decodeFollowCursor, followPage } from './follow-pagination';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFollowList(
    viewerId: string,
    userId: string,
    direction: 'followers' | 'following',
    { cursor, limit = 20 }: FollowListQueryDto,
  ): Promise<FollowListPage> {
    const scope = { userId, direction };
    const after = decodeFollowCursor(cursor, scope);

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const users = await this.prisma.user.findMany({
      where: {
        ...(after === undefined ? {} : { id: { gt: after } }),
        ...(direction === 'followers'
          ? { following: { some: { followingId: userId } } }
          : { followers: { some: { followerId: userId } } }),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        followers: {
          where: { followerId: viewerId },
          select: { followerId: true },
          take: 1,
        },
      },
    });
    const page = followPage(users, limit, scope);
    const items = page.items.map(({ followers, ...user }) => ({
      ...user,
      isFollowing: followers.length > 0,
    }));
    return {
      items,
      nextCursor: page.nextCursor,
    };
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const key = { followerId, followingId };
    try {
      return await this.prisma.follow.upsert({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
        update: {},
        create: {
          followerId,
          followingId,
        },
      });
    } catch (error) {
      // Prisma may emulate upsert; a concurrent insert can win the unique key.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.follow.findUnique({
          where: { followerId_followingId: key },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async unfollow(followerId: string, followingId: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });
  }

  async getFollowStatus(
    followerId: string,
    followingId: string,
  ): Promise<FollowStatus> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return {
      isFollowing: follow !== null,
    };
  }

  async getCounts(userId: string): Promise<FollowCounts> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [followerCount, followingCount] = await this.prisma.$transaction([
      this.prisma.follow.count({
        where: { followingId: userId },
      }),
      this.prisma.follow.count({
        where: { followerId: userId },
      }),
    ]);

    return {
      followerCount,
      followingCount,
    };
  }
}
