import { Injectable, NotFoundException } from '@nestjs/common';
import { PostLike, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  buildPage,
  keyset,
  pageLimit,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { StorageService } from '../storage/storage.service';
import { canViewTrip } from '../trips/trip-rules';
import type {
  LikeStatusResponse,
  PaginatedResponse,
  PostLikerResponse,
} from 'shared-types';

// Who liked a post, newest first
const LIKERS = keyset<
  PostLike,
  Prisma.PostLikeWhereInput,
  Prisma.PostLikeOrderByWithRelationInput
>([
  { field: 'createdAt', direction: 'desc', type: 'date' },
  { field: 'userId', direction: 'desc', type: 'string' },
]);

@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Idempotent: liking a post you already like keeps the one row.
  async like(userId: string, postId: string): Promise<LikeStatusResponse> {
    await this.assertCanViewPost(userId, postId);

    try {
      // ON CONFLICT DO NOTHING, so a double tap (or two requests at once)
      // can't fail or make a second row
      await this.prisma.postLike.createMany({
        data: { userId, postId },
        skipDuplicates: true,
      });
    } catch (e) {
      // The post was deleted after the check above
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new NotFoundException('Post not found');
      }
      throw e;
    }

    return this.status(postId, true);
  }

  // Idempotent: unliking a post you don't like is a no-op.
  async unlike(userId: string, postId: string): Promise<LikeStatusResponse> {
    await this.assertCanViewPost(userId, postId);
    await this.prisma.postLike.deleteMany({ where: { userId, postId } });
    return this.status(postId, false);
  }

  // Who liked a post, newest first. Anyone who can see the post can see this.
  async listLikers(
    viewerId: string,
    postId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PostLikerResponse>> {
    await this.assertCanViewPost(viewerId, postId);

    const list = `likers:${postId}`;
    const limit = pageLimit(query);
    const likes = await this.prisma.postLike.findMany({
      where: {
        postId,
        ...LIKERS.after(LIKERS.decode(query.cursor, list)),
      },
      orderBy: LIKERS.orderBy,
      include: {
        user: {
          select: {
            ...userSummarySelect,
            followers: {
              where: { followerId: viewerId },
              select: { followerId: true },
            },
          },
        },
      },
      take: limit + 1,
    });

    const page = buildPage(likes, limit, (like) => LIKERS.cursor(list, like));
    return {
      items: await Promise.all(
        page.items.map(async ({ user, createdAt }) => ({
          ...(await toUserSummary(user, this.storage)),
          isFollowing: user.followers.length > 0,
          likedAt: createdAt.toISOString(),
        })),
      ),
      nextCursor: page.nextCursor,
    };
  }

  private async status(
    postId: string,
    liked: boolean,
  ): Promise<LikeStatusResponse> {
    const likeCount = await this.prisma.postLike.count({ where: { postId } });
    return { liked, likeCount };
  }

  // A post you can't see is a 404, same as GET /api/posts/:id
  private async assertCanViewPost(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { trip: { select: { ownerId: true, status: true } } },
    });
    if (!post || !canViewTrip(viewerId, post.trip)) {
      throw new NotFoundException('Post not found');
    }
  }
}
