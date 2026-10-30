import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LikesService } from './likes.service';

const postId = '22222222-2222-4222-8222-222222222222';
const ownerId = 'user_owner';
const viewerId = 'user_viewer';

const publishedPost = { trip: { ownerId, status: 'published' } };
const draftPost = { trip: { ownerId, status: 'draft' } };

function liker(id: string, isFollowed = false) {
  return {
    userId: id,
    postId,
    createdAt: new Date('2026-10-20T12:00:00Z'),
    user: {
      id,
      username: id,
      firstName: 'Liker',
      lastName: 'Test',
      avatarUrl: null,
      followers: isFollowed ? [{ followerId: viewerId }] : [],
    },
  };
}

describe('LikesService', () => {
  let service: LikesService;

  const prisma = {
    post: { findUnique: jest.fn() },
    postLike: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.post.findUnique.mockResolvedValue(publishedPost);
    prisma.postLike.count.mockResolvedValue(1);

    const module = await Test.createTestingModule({
      providers: [LikesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LikesService);
  });

  describe('like', () => {
    it('inserts with ON CONFLICT DO NOTHING and returns the count', async () => {
      await expect(service.like(viewerId, postId)).resolves.toEqual({
        liked: true,
        likeCount: 1,
      });
      expect(prisma.postLike.createMany).toHaveBeenCalledWith({
        data: { userId: viewerId, postId },
        skipDuplicates: true,
      });
      expect(prisma.postLike.count).toHaveBeenCalledWith({
        where: { postId },
      });
    });

    it("returns 404 for a post on someone else's draft", async () => {
      prisma.post.findUnique.mockResolvedValue(draftPost);
      await expect(service.like(viewerId, postId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.postLike.createMany).not.toHaveBeenCalled();
    });

    it('lets the owner like a post on their own draft', async () => {
      prisma.post.findUnique.mockResolvedValue(draftPost);
      await expect(service.like(ownerId, postId)).resolves.toMatchObject({
        liked: true,
      });
    });

    it("returns 404 for a post that doesn't exist", async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.like(viewerId, postId)).rejects.toThrow(
        'Post not found',
      );
    });

    it('returns 404 when the post is deleted mid-request', async () => {
      prisma.postLike.createMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );
      await expect(service.like(viewerId, postId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unlike', () => {
    it('deletes the like without checking it exists', async () => {
      prisma.postLike.count.mockResolvedValue(0);
      await expect(service.unlike(viewerId, postId)).resolves.toEqual({
        liked: false,
        likeCount: 0,
      });
      expect(prisma.postLike.deleteMany).toHaveBeenCalledWith({
        where: { userId: viewerId, postId },
      });
    });

    it("returns 404 for a post you can't see", async () => {
      prisma.post.findUnique.mockResolvedValue(draftPost);
      await expect(service.unlike(viewerId, postId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.postLike.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('listLikers', () => {
    it('lists likers newest first with whether you follow them', async () => {
      prisma.postLike.findMany.mockResolvedValue([
        liker('user_a', true),
        liker('user_b'),
      ]);

      const page = await service.listLikers(viewerId, postId, {});

      expect(prisma.postLike.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { postId },
          orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
          take: 21,
        }),
      );
      expect(page).toEqual({
        items: [
          expect.objectContaining({
            id: 'user_a',
            isFollowing: true,
            likedAt: '2026-10-20T12:00:00.000Z',
          }),
          expect.objectContaining({ id: 'user_b', isFollowing: false }),
        ],
        nextCursor: null,
      });
    });

    it("pages by the liker's user ID", async () => {
      prisma.postLike.findUnique.mockResolvedValue(liker('user_a'));
      prisma.postLike.findMany.mockResolvedValue([
        liker('user_b'),
        liker('user_c'),
      ]);

      const page = await service.listLikers(viewerId, postId, {
        cursor: 'user_a',
        limit: 1,
      });

      expect(prisma.postLike.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { userId_postId: { userId: 'user_a', postId } },
          skip: 1,
          take: 2,
        }),
      );
      expect(page.items).toHaveLength(1);
      expect(page.nextCursor).toBe('user_b');
    });

    it("rejects a cursor that isn't a like on this post", async () => {
      prisma.postLike.findUnique.mockResolvedValue(null);
      await expect(
        service.listLikers(viewerId, postId, { cursor: 'user_x' }),
      ).rejects.toThrow('Invalid cursor');
      expect(prisma.postLike.findMany).not.toHaveBeenCalled();
    });

    it("returns 404 for a post you can't see", async () => {
      prisma.post.findUnique.mockResolvedValue(draftPost);
      await expect(service.listLikers(viewerId, postId, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
