import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Comment, Prisma } from '../generated/prisma/client';
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
import type { CommentResponse, PaginatedResponse } from 'shared-types';
import { CreateCommentDto } from './dto/create-comment.dto';

const commentInclude = {
  author: { select: userSummarySelect },
  replyTo: { select: userSummarySelect },
  _count: { select: { replies: true } },
} satisfies Prisma.CommentInclude;

type CommentWithDetails = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

// Comments and replies read in conversation order, oldest first
// Comments and replies, oldest first
const COMMENTS = keyset<
  Comment,
  Prisma.CommentWhereInput,
  Prisma.CommentOrderByWithRelationInput
>([
  { field: 'createdAt', direction: 'asc', type: 'date' },
  { field: 'id', direction: 'asc', type: 'string' },
]);

const tripVisibilitySelect = {
  trip: { select: { ownerId: true, status: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(
    userId: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    await this.assertCanViewPost(userId, postId);

    let parentCommentId: string | null = null;
    let replyToUserId: string | null = null;
    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
        select: {
          id: true,
          postId: true,
          parentCommentId: true,
          authorId: true,
        },
      });
      if (!parent) {
        throw new NotFoundException('Comment not found');
      }
      if (parent.postId !== postId) {
        throw new BadRequestException(
          'parentCommentId must be a comment on this post',
        );
      }
      if (parent.parentCommentId) {
        // Replying to a reply: attach to the same top-level comment, and
        // @mention the reply's author (unless that's you)
        parentCommentId = parent.parentCommentId;
        replyToUserId = parent.authorId === userId ? null : parent.authorId;
      } else {
        parentCommentId = parent.id;
      }
    }

    try {
      const comment = await this.prisma.comment.create({
        data: {
          postId,
          authorId: userId,
          parentCommentId,
          replyToUserId,
          body: dto.body,
        },
        include: commentInclude,
      });
      return await this.toResponse(comment);
    } catch (e) {
      // The post or the parent comment was deleted after the checks above
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        const post = await this.prisma.post.findUnique({
          where: { id: postId },
          select: { id: true },
        });
        throw new NotFoundException(
          post ? 'Comment not found' : 'Post not found',
        );
      }
      throw e;
    }
  }

  // A post's top-level comments, oldest first, each with its reply count
  async listForPost(
    viewerId: string,
    postId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<CommentResponse>> {
    await this.assertCanViewPost(viewerId, postId);

    return this.page(
      { postId, parentCommentId: null },
      `comments:${postId}`,
      query,
    );
  }

  // A top-level comment's replies, oldest first
  async listReplies(
    viewerId: string,
    commentId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<CommentResponse>> {
    const comment = await this.getVisibleComment(viewerId, commentId);
    if (comment.parentCommentId) {
      throw new BadRequestException(
        'Only top-level comments have replies; list the parent comment instead',
      );
    }

    return this.page(
      { parentCommentId: commentId },
      `replies:${commentId}`,
      query,
    );
  }

  private async page(
    where: Prisma.CommentWhereInput,
    list: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<CommentResponse>> {
    const limit = pageLimit(query);
    const comments = await this.prisma.comment.findMany({
      where: {
        ...where,
        ...COMMENTS.after(COMMENTS.decode(query.cursor, list)),
      },
      orderBy: COMMENTS.orderBy,
      include: commentInclude,
      take: limit + 1,
    });

    const page = buildPage(comments, limit, (c) => COMMENTS.cursor(list, c));
    return {
      items: await Promise.all(page.items.map((c) => this.toResponse(c))),
      nextCursor: page.nextCursor,
    };
  }

  // Only the author can delete a comment. Deleting a top-level comment
  // deletes its replies (ON DELETE CASCADE).
  async remove(userId: string, commentId: string): Promise<void> {
    const comment = await this.getVisibleComment(userId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.comment.deleteMany({ where: { id: commentId } });
  }

  // A comment on a post you can't see is a 404, so drafts don't leak
  private async getVisibleComment(viewerId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        parentCommentId: true,
        post: { select: tripVisibilitySelect },
      },
    });
    if (!comment || !canViewTrip(viewerId, comment.post.trip)) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  // A deleted post, or one you can't see, is a 404 "Post not found"
  private async assertCanViewPost(viewerId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: tripVisibilitySelect,
    });
    if (!post || !canViewTrip(viewerId, post.trip)) {
      throw new NotFoundException('Post not found');
    }
  }

  private async toResponse(
    comment: CommentWithDetails,
  ): Promise<CommentResponse> {
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      author: await toUserSummary(comment.author, this.storage),
      replyTo: comment.replyTo
        ? await toUserSummary(comment.replyTo, this.storage)
        : null,
      body: comment.body,
      replyCount: comment._count.replies,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
