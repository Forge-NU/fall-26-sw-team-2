import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FollowListQueryDto } from './dto/follow-list-query.dto';
import { Prisma } from '../generated/prisma/client';
import { FollowsService } from './follows.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('FollowsService', () => {
  describe('follow mutations and counts', () => {
    const relation = {
      followerId: 'alice',
      followingId: 'bob',
      createdAt: new Date(),
    };
    const setup = () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'bob' }) },
        follow: {
          upsert: jest.fn().mockResolvedValue(relation),
          findUnique: jest.fn().mockResolvedValue(relation),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          count: jest.fn(),
        },
        $transaction: jest.fn((queries: Promise<number>[]) =>
          Promise.all(queries),
        ),
      };
      return {
        prisma,
        service: new FollowsService(prisma as unknown as PrismaService),
      };
    };

    it('returns the existing relation on repeated follow', async () => {
      const { prisma, service } = setup();
      await expect(service.follow('alice', 'bob')).resolves.toEqual(relation);
      await expect(service.follow('alice', 'bob')).resolves.toEqual(relation);
      expect(prisma.follow.upsert).toHaveBeenCalledWith({
        where: {
          followerId_followingId: { followerId: 'alice', followingId: 'bob' },
        },
        update: {},
        create: { followerId: 'alice', followingId: 'bob' },
      });
    });

    it('returns the winning relation after a concurrent unique-key conflict', async () => {
      const { prisma, service } = setup();
      prisma.follow.upsert.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );
      await expect(service.follow('alice', 'bob')).resolves.toEqual(relation);
      expect(prisma.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerId_followingId: { followerId: 'alice', followingId: 'bob' },
        },
      });
    });

    it('propagates unrelated database failures', async () => {
      const { prisma, service } = setup();
      const error = new Error('database unavailable');
      prisma.follow.upsert.mockRejectedValue(error);
      await expect(service.follow('alice', 'bob')).rejects.toBe(error);
    });

    it('allows repeated unfollow, including an absent relation', async () => {
      const { prisma, service } = setup();
      prisma.follow.deleteMany.mockResolvedValueOnce({ count: 1 });
      await expect(service.unfollow('alice', 'bob')).resolves.toBeUndefined();
      await expect(service.unfollow('alice', 'bob')).resolves.toBeUndefined();
      expect(prisma.follow.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.follow.deleteMany).toHaveBeenLastCalledWith({
        where: { followerId: 'alice', followingId: 'bob' },
      });
    });

    it.each(['follow', 'unfollow', 'getFollowStatus'] as const)(
      '%s rejects a missing target',
      async (method) => {
        const { prisma, service } = setup();
        prisma.user.findUnique.mockResolvedValue(null);
        await expect(
          service[method]('alice', 'missing'),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.follow.upsert).not.toHaveBeenCalled();
        expect(prisma.follow.deleteMany).not.toHaveBeenCalled();
      },
    );

    it('counts incoming and outgoing relationships in a transaction', async () => {
      const { prisma, service } = setup();
      prisma.follow.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      await expect(service.getCounts('alice')).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
      });
      expect(prisma.follow.count).toHaveBeenNthCalledWith(1, {
        where: { followingId: 'alice' },
      });
      expect(prisma.follow.count).toHaveBeenNthCalledWith(2, {
        where: { followerId: 'alice' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not count relationships for a missing user', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getCounts('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.follow.count).not.toHaveBeenCalled();
    });
  });
  describe('follow lists', () => {
    const row = (id: string, followed = false) => ({
      id,
      username: id,
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: null,
      followers: followed ? [{ followerId: 'viewer' }] : [],
    });
    const setup = () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'target' }),
          findMany: jest.fn(),
        },
      };
      return {
        prisma,
        service: new FollowsService(prisma as unknown as PrismaService),
      };
    };

    it.each(['followers', 'following'] as const)(
      'paginates %s and computes viewer-relative state',
      async (direction) => {
        const { prisma, service } = setup();
        prisma.user.findMany.mockResolvedValueOnce([
          row('a', true),
          row('b'),
          row('c'),
        ]);
        const first = await service.getFollowList(
          'viewer',
          'target',
          direction,
          { limit: 2 },
        );
        expect(
          first.items.map(({ id, isFollowing }) => ({ id, isFollowing })),
        ).toEqual([
          { id: 'a', isFollowing: true },
          { id: 'b', isFollowing: false },
        ]);
        expect(first.items[0]).not.toHaveProperty('followers');
        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where:
              direction === 'followers'
                ? { following: { some: { followingId: 'target' } } }
                : { followers: { some: { followerId: 'target' } } },
            take: 3,
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              followers: {
                where: { followerId: 'viewer' },
                select: { followerId: true },
                take: 1,
              },
            },
          }),
        );
        prisma.user.findMany.mockResolvedValueOnce([row('c')]);
        const second = await service.getFollowList(
          'viewer',
          'target',
          direction,
          { limit: 2, cursor: first.nextCursor! },
        );
        expect(second.items.map(({ id }) => id)).toEqual(['c']);
        expect(second.nextCursor).toBeNull();
        // A range query still works if the previous relationship was deleted.
        expect(prisma.user.findMany).toHaveBeenLastCalledWith(
          expect.objectContaining({
            where: {
              id: { gt: 'b' },
              ...(direction === 'followers'
                ? { following: { some: { followingId: 'target' } } }
                : { followers: { some: { followerId: 'target' } } }),
            },
            orderBy: { id: 'asc' },
          }),
        );
      },
    );

    it('returns an empty page for an existing user with no follows', async () => {
      const { prisma, service } = setup();
      prisma.user.findMany.mockResolvedValue([]);
      await expect(
        service.getFollowList('viewer', 'target', 'followers', { limit: 20 }),
      ).resolves.toEqual({ items: [], nextCursor: null });
    });

    it('returns 404 for a missing target', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.getFollowList('viewer', 'missing', 'followers', { limit: 20 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it.each([
      'invalid',
      '',
      Buffer.from(
        JSON.stringify({ id: 'a', userId: 'other', direction: 'followers' }),
      ).toString('base64url'),
      Buffer.from(
        JSON.stringify({ id: 'a', userId: 'target', direction: 'following' }),
      ).toString('base64url'),
    ])('rejects malformed or mismatched cursors', async (cursor) => {
      const { prisma, service } = setup();
      await expect(
        service.getFollowList('viewer', 'target', 'followers', {
          limit: 20,
          cursor,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('list query validation', () => {
    it('defaults to 20 and converts numeric query strings', async () => {
      expect(plainToInstance(FollowListQueryDto, {}).limit).toBe(20);
      const query = plainToInstance(FollowListQueryDto, { limit: '100' });
      expect(query.limit).toBe(100);
      expect(await validate(query)).toEqual([]);
    });
    it.each(['0', '-1', '101', '1.5', 'abc', ''])(
      'rejects invalid limit %s',
      async (limit) => {
        expect(
          (await validate(plainToInstance(FollowListQueryDto, { limit })))
            .length,
        ).toBeGreaterThan(0);
      },
    );
  });
  it('rejects self-follow without writing to the database', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(),
      },
      follow: {
        upsert: jest.fn(),
      },
    };

    const service = new FollowsService(prisma as unknown as PrismaService);

    await expect(
      service.follow('user_alice', 'user_alice'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.follow.upsert).not.toHaveBeenCalled();
  });
});
