import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parseDateOnly } from '../common/dates';
import { TripsService } from './trips.service';

const owner = {
  id: 'user_owner',
  username: 'owner',
  firstName: 'Olive',
  lastName: 'Owner',
  avatarUrl: null,
};

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: owner.id,
    title: 'Lisbon',
    destination: 'Lisbon, Portugal',
    description: null,
    startDate: parseDateOnly('2026-10-12'),
    endDate: parseDateOnly('2026-10-16'),
    status: 'draft',
    publishedAt: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    owner,
    _count: { posts: 0 },
    posts: [],
    ...overrides,
  };
}

describe('TripsService', () => {
  let service: TripsService;

  const prisma = {
    trip: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    post: { count: jest.fn() },
    postMedia: { findMany: jest.fn() },
    story: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  const storage = {
    getReadUrl: jest.fn((key: string) => Promise.resolve(`https://s3/${key}`)),
    deleteObjects: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    prisma.story.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(TripsService);
  });

  describe('create', () => {
    it('creates a draft and returns the response shape', async () => {
      prisma.trip.create.mockResolvedValue(makeTrip());

      const trip = await service.create(owner.id, {
        title: 'Lisbon',
        destination: 'Lisbon, Portugal',
        startDate: '2026-10-12',
        endDate: '2026-10-16',
      });

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: owner.id,
            startDate: parseDateOnly('2026-10-12'),
            endDate: parseDateOnly('2026-10-16'),
          }) as unknown,
        }),
      );
      expect(trip).toMatchObject({
        startDate: '2026-10-12',
        endDate: '2026-10-16',
        status: 'draft',
        publishedAt: null,
        postCount: 0,
        coverImageUrl: null,
        owner,
      });
    });

    it('rejects an end date before the start date', async () => {
      await expect(
        service.create(owner.id, {
          title: 'Lisbon',
          destination: 'Lisbon, Portugal',
          startDate: '2026-10-16',
          endDate: '2026-10-12',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.trip.create).not.toHaveBeenCalled();
    });

    it('allows a one-day trip', async () => {
      prisma.trip.create.mockResolvedValue(makeTrip());
      await expect(
        service.create(owner.id, {
          title: 'Day trip',
          destination: 'Sintra',
          startDate: '2026-10-12',
          endDate: '2026-10-12',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('uses the first photo of the first post as the cover', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({
          status: 'published',
          posts: [{ media: [{ s3Key: 'users/user_owner/posts/a.jpg' }] }],
          _count: { posts: 3 },
        }),
      );

      const trip = await service.findOne('user_other', makeTrip().id);

      expect(trip.coverImageUrl).toBe(
        'https://s3/users/user_owner/posts/a.jpg',
      );
      expect(trip.postCount).toBe(3);
    });

    it("returns 404 for someone else's draft", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      await expect(
        service.findOne('user_other', makeTrip().id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('owner check', () => {
    it('returns 404 when the trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);
      await expect(
        service.update(owner.id, makeTrip().id, { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns 404 for someone else's draft, so it doesn't leak", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      await expect(
        service.update('user_other', makeTrip().id, { title: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns 403 for someone else's published trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      await expect(
        service.update('user_other', makeTrip().id, { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(service.remove('user_other', makeTrip().id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.publish('user_other', makeTrip().id),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.trip.update).not.toHaveBeenCalled();
      expect(prisma.trip.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.trip.update.mockResolvedValue(makeTrip());
    });

    it('rejects an end date before the existing start date', async () => {
      await expect(
        service.update(owner.id, makeTrip().id, { endDate: '2026-10-11' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.trip.update).not.toHaveBeenCalled();
    });

    it('rejects new dates that leave posts outside the trip', async () => {
      prisma.post.count.mockResolvedValue(2);
      await expect(
        service.update(owner.id, makeTrip().id, { startDate: '2026-10-14' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.post.count).toHaveBeenCalledWith({
        where: {
          tripId: makeTrip().id,
          OR: [
            { visitedOn: { lt: parseDateOnly('2026-10-14') } },
            { visitedOn: { gt: parseDateOnly('2026-10-16') } },
          ],
        },
      });
    });

    it('locks the trip while checking posts against the new dates', async () => {
      prisma.post.count.mockResolvedValue(0);
      await service.update(owner.id, makeTrip().id, { endDate: '2026-10-20' });
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.trip.update).toHaveBeenCalled();
    });

    it("doesn't check posts when the dates don't change", async () => {
      await service.update(owner.id, makeTrip().id, { title: 'New' });
      expect(prisma.post.count).not.toHaveBeenCalled();
    });

    it('clears the description with null or an empty string', async () => {
      await service.update(owner.id, makeTrip().id, { description: null });
      await service.update(owner.id, makeTrip().id, { description: '' });
      for (const [args] of prisma.trip.update.mock.calls as [
        { data: { description: unknown } },
      ][]) {
        expect(args.data.description).toBeNull();
      }
    });
  });

  describe('remove', () => {
    it('deletes the trip, then its S3 objects', async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.postMedia.findMany.mockResolvedValue([
        { s3Key: 'users/user_owner/posts/a.jpg' },
        { s3Key: 'users/user_owner/posts/b.jpg' },
      ]);

      await service.remove(owner.id, makeTrip().id);

      expect(prisma.trip.deleteMany).toHaveBeenCalledWith({
        where: { id: makeTrip().id },
      });
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        'users/user_owner/posts/a.jpg',
        'users/user_owner/posts/b.jpg',
      ]);
    });

    it("also deletes the S3 objects of the trip's stories", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.postMedia.findMany.mockResolvedValue([
        { s3Key: 'users/user_owner/posts/a.jpg' },
      ]);
      prisma.story.findMany.mockResolvedValue([
        { s3Key: 'users/user_owner/stories/s.jpg' },
      ]);

      await service.remove(owner.id, makeTrip().id);

      expect(prisma.story.findMany).toHaveBeenCalledWith({
        where: { tripId: makeTrip().id },
        select: { s3Key: true },
      });
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        'users/user_owner/posts/a.jpg',
        'users/user_owner/stories/s.jpg',
      ]);
    });
  });

  describe('publish', () => {
    it('rejects a trip with no posts', async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      await expect(service.publish(owner.id, makeTrip().id)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.trip.update).not.toHaveBeenCalled();
    });

    it('locks the trip, then sets status and publishedAt', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ _count: { posts: 1 } }),
      );
      prisma.trip.update.mockResolvedValue(
        makeTrip({ status: 'published', publishedAt: new Date() }),
      );

      const trip = await service.publish(owner.id, makeTrip().id);

      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'published', publishedAt: expect.any(Date) as Date },
        }),
      );
      expect(trip.status).toBe('published');
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('does nothing for an already-published trip', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published', publishedAt: new Date() }),
      );
      const trip = await service.publish(owner.id, makeTrip().id);
      expect(prisma.trip.update).not.toHaveBeenCalled();
      expect(trip.status).toBe('published');
    });
  });

  describe('listForUser', () => {
    it('includes drafts on your own profile', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      prisma.trip.findMany.mockResolvedValue([]);
      await service.listForUser(owner.id, owner.id, {});
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: owner.id } }),
      );
    });

    it("only includes published trips on someone else's profile", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      prisma.trip.findMany.mockResolvedValue([]);
      await service.listForUser('user_other', owner.id, {});
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: owner.id, status: 'published' },
        }),
      );
    });

    it('returns a next cursor when there are more trips', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      prisma.trip.findMany.mockResolvedValue([
        makeTrip({ id: 'a' }),
        makeTrip({ id: 'b' }),
        makeTrip({ id: 'c' }),
      ]);

      const page = await service.listForUser(owner.id, owner.id, { limit: 2 });

      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
      expect(page.items.map((t) => t.id)).toEqual(['a', 'b']);
      expect(page.nextCursor).toBe('b');
    });

    it('rejects a cursor that is not in the list', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      prisma.trip.findFirst.mockResolvedValue(null);
      await expect(
        service.listForUser('user_other', owner.id, {
          cursor: makeTrip().id,
        }),
      ).rejects.toThrow('Invalid cursor');
      expect(prisma.trip.findFirst).toHaveBeenCalledWith({
        where: { id: makeTrip().id, ownerId: owner.id, status: 'published' },
        select: { id: true },
      });
      expect(prisma.trip.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 for a user that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.listForUser(owner.id, 'user_missing', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActive', () => {
    it("only returns the user's drafts whose dates include today", async () => {
      prisma.trip.findMany.mockResolvedValue([]);
      const today = new Date().toISOString().slice(0, 10);

      await service.listActive(owner.id, today);

      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ownerId: owner.id,
            status: 'draft',
            startDate: { lte: parseDateOnly(today) },
            endDate: { gte: parseDateOnly(today) },
          },
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });
  });
});
