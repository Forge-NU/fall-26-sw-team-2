import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

const postId = '22222222-2222-4222-8222-222222222222';
const otherPostId = '44444444-4444-4444-8444-444444444444';
const topId = '33333333-3333-4333-8333-333333333333';
const replyId = '55555555-5555-4555-8555-555555555555';
const ownerId = 'user_owner';
const viewerId = 'user_viewer';
const replierId = 'user_replier';

const published = { trip: { ownerId, status: 'published' } };
const draft = { trip: { ownerId, status: 'draft' } };

function user(id: string) {
  return {
    id,
    username: id,
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
  };
}

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: topId,
    postId,
    authorId: viewerId,
    parentCommentId: null,
    replyToUserId: null,
    body: 'Love this',
    createdAt: new Date('2026-10-20T12:00:00Z'),
    author: user(viewerId),
    replyTo: null,
    _count: { replies: 0 },
    ...overrides,
  };
}

describe('CommentsService', () => {
  let service: CommentsService;

  const prisma = {
    post: { findUnique: jest.fn() },
    comment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.post.findUnique.mockResolvedValue(published);
    prisma.comment.create.mockResolvedValue(makeComment());

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('creates a top-level comment', async () => {
      const comment = await service.create(viewerId, postId, {
        body: 'Love this',
      });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            postId,
            authorId: viewerId,
            parentCommentId: null,
            replyToUserId: null,
            body: 'Love this',
          },
        }),
      );
      expect(comment).toMatchObject({
        id: topId,
        parentCommentId: null,
        replyTo: null,
        replyCount: 0,
        author: { id: viewerId },
      });
    });

    it('replies to a top-level comment without a mention', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: topId,
        postId,
        parentCommentId: null,
        authorId: viewerId,
      });

      await service.create(replierId, postId, {
        body: 'Same!',
        parentCommentId: topId,
      });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentCommentId: topId,
            replyToUserId: null,
          }) as unknown,
        }),
      );
    });

    it('attaches a reply to a reply to the top-level comment, with a mention', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: replyId,
        postId,
        parentCommentId: topId,
        authorId: replierId,
      });

      await service.create(viewerId, postId, {
        body: 'Ha, agreed',
        parentCommentId: replyId,
      });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentCommentId: topId,
            replyToUserId: replierId,
          }) as unknown,
        }),
      );
    });

    it("doesn't mention you when you reply to your own reply", async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: replyId,
        postId,
        parentCommentId: topId,
        authorId: viewerId,
      });

      await service.create(viewerId, postId, {
        body: 'Also',
        parentCommentId: replyId,
      });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parentCommentId: topId,
            replyToUserId: null,
          }) as unknown,
        }),
      );
    });

    it('rejects a parent comment on another post', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: topId,
        postId: otherPostId,
        parentCommentId: null,
        authorId: viewerId,
      });
      await expect(
        service.create(viewerId, postId, { body: 'x', parentCommentId: topId }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it("returns 404 for a parent comment that doesn't exist", async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      await expect(
        service.create(viewerId, postId, { body: 'x', parentCommentId: topId }),
      ).rejects.toThrow('Comment not found');
    });

    it('returns 404 "Post not found" for a deleted post', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(
        service.create(viewerId, postId, { body: 'x' }),
      ).rejects.toThrow('Post not found');
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it("returns 404 for a post on someone else's draft", async () => {
      prisma.post.findUnique.mockResolvedValue(draft);
      await expect(
        service.create(viewerId, postId, { body: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 404 "Post not found" when the post is deleted mid-request', async () => {
      prisma.post.findUnique
        .mockResolvedValueOnce(published)
        .mockResolvedValueOnce(null);
      prisma.comment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.create(viewerId, postId, { body: 'x' }),
      ).rejects.toThrow('Post not found');
    });
  });

  describe('CreateCommentDto', () => {
    async function errors(body: unknown) {
      const dto = plainToInstance(CreateCommentDto, { body });
      return validate(dto);
    }

    it('accepts 500 characters, counting emoji like Postgres', async () => {
      expect(await errors('a'.repeat(500))).toHaveLength(0);
      // ❤️ is two code points, so 250 of them is exactly 500
      expect(await errors('❤️'.repeat(250))).toHaveLength(0);
    });

    it('rejects over 500 characters', async () => {
      expect(await errors('a'.repeat(501))).not.toHaveLength(0);
      expect(await errors('❤️'.repeat(251))).not.toHaveLength(0);
    });

    it('rejects an empty or whitespace-only comment', async () => {
      expect(await errors('')).not.toHaveLength(0);
      expect(await errors('   ')).not.toHaveLength(0);
    });
  });

  describe('listForPost', () => {
    it('lists top-level comments oldest first with reply counts', async () => {
      prisma.comment.findMany.mockResolvedValue([
        makeComment({ _count: { replies: 3 } }),
      ]);

      const page = await service.listForPost(viewerId, postId, {});

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId, parentCommentId: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 21,
        }),
      );
      expect(page).toEqual({
        items: [expect.objectContaining({ id: topId, replyCount: 3 })],
        nextCursor: null,
      });
    });

    it("rejects a cursor that isn't a top-level comment on the post", async () => {
      prisma.comment.findFirst.mockResolvedValue(null);
      await expect(
        service.listForPost(viewerId, postId, { cursor: replyId }),
      ).rejects.toThrow('Invalid cursor');
    });

    it("returns 404 for a post you can't see", async () => {
      prisma.post.findUnique.mockResolvedValue(draft);
      await expect(service.listForPost(viewerId, postId, {})).rejects.toThrow(
        'Post not found',
      );
    });
  });

  describe('listReplies', () => {
    const visible = (overrides: Record<string, unknown> = {}) => ({
      authorId: viewerId,
      parentCommentId: null,
      post: published,
      ...overrides,
    });

    it("lists a top-level comment's replies oldest first", async () => {
      prisma.comment.findUnique.mockResolvedValue(visible());
      prisma.comment.findMany.mockResolvedValue([
        makeComment({
          id: replyId,
          parentCommentId: topId,
          replyTo: user(replierId),
        }),
      ]);

      const page = await service.listReplies(viewerId, topId, {});

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentCommentId: topId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(page.items[0]).toMatchObject({
        id: replyId,
        parentCommentId: topId,
        replyTo: { id: replierId },
      });
    });

    it('rejects listing the replies of a reply', async () => {
      prisma.comment.findUnique.mockResolvedValue(
        visible({ parentCommentId: topId }),
      );
      await expect(service.listReplies(viewerId, replyId, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it("returns 404 for a comment on a post you can't see", async () => {
      prisma.comment.findUnique.mockResolvedValue(visible({ post: draft }));
      await expect(service.listReplies(viewerId, topId, {})).rejects.toThrow(
        'Comment not found',
      );
    });
  });

  describe('remove', () => {
    it('deletes your own comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        authorId: viewerId,
        parentCommentId: null,
        post: published,
      });
      await service.remove(viewerId, topId);
      expect(prisma.comment.deleteMany).toHaveBeenCalledWith({
        where: { id: topId },
      });
    });

    it("returns 403 for someone else's comment, even the post owner", async () => {
      prisma.comment.findUnique.mockResolvedValue({
        authorId: viewerId,
        parentCommentId: null,
        post: published,
      });
      await expect(service.remove(ownerId, topId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.comment.deleteMany).not.toHaveBeenCalled();
    });

    it("returns 404 for a comment that doesn't exist", async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      await expect(service.remove(viewerId, topId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
