import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parseDateOnly } from '../common/dates';
import { decodeCursor, encodeCursor } from '../common/pagination';
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
    _count: { posts: 0, saves: 0 },
    posts: [],
    saves: [],
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
    post: { count: jest.fn(), groupBy: jest.fn() },
    tripSave: { findFirst: jest.fn(), findMany: jest.fn() },
    postMedia: { findMany: jest.fn() },
    story: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const storage = {
    getReadUrl: jest.fn((key: string) => Promise.resolve(`https://s3/${key}`)),
    deleteObjects: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // The trip's rated posts, for the place ratings
    prisma.post.groupBy.mockResolvedValue([]);
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

  describe('findManyForViewer', () => {
    it('loads every id in one query and leaves out drafts you cannot see', async () => {
      const published = makeTrip({ status: 'published' });
      const othersDraft = makeTrip({
        id: '22222222-2222-4222-8222-222222222222',
      });
      prisma.trip.findMany.mockResolvedValue([published, othersDraft]);

      const trips = await service.findManyForViewer('user_other', [
        published.id,
        othersDraft.id,
        '33333333-3333-4333-8333-333333333333',
      ]);

      expect(prisma.trip.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: {
              in: [
                published.id,
                othersDraft.id,
                '33333333-3333-4333-8333-333333333333',
              ],
            },
          },
        }),
      );
      expect([...trips.keys()]).toEqual([published.id]);
    });
  });

  describe('findOne', () => {
    it('uses the first photo of the first post as the cover', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({
          status: 'published',
          posts: [{ media: [{ s3Key: 'users/user_owner/posts/a.jpg' }] }],
          _count: { posts: 3, saves: 0 },
        }),
      );

      const trip = await service.findOne('user_other', makeTrip().id);

      expect(trip.coverImageUrl).toBe(
        'https://s3/users/user_owner/posts/a.jpg',
      );
      expect(trip.postCount).toBe(3);
    });

    it("returns the save count and whether you've saved it", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({
          status: 'published',
          _count: { posts: 1, saves: 4 },
          saves: [{ userId: 'user_other' }],
        }),
      );

      const trip = await service.findOne('user_other', makeTrip().id);

      const [args] = prisma.trip.findUnique.mock.calls[0] as [
        { include: Record<string, unknown> },
      ];
      expect(args.include).toMatchObject({
        saves: { where: { userId: 'user_other' }, select: { userId: true } },
      });
      expect(trip).toMatchObject({ saveCount: 4, savedByMe: true });
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

    it("recomputes the places the trip's posts rated, after the delete", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.postMedia.findMany.mockResolvedValue([]);
      prisma.post.groupBy.mockResolvedValue([
        { locationId: 'loc_b' },
        { locationId: 'loc_a' },
      ]);
      const order: string[] = [];
      prisma.trip.deleteMany.mockImplementation(() => {
        order.push('delete');
        return Promise.resolve({ count: 1 });
      });
      prisma.$executeRaw.mockImplementation(() => {
        order.push('refresh');
        return Promise.resolve(2);
      });

      await service.remove(owner.id, makeTrip().id);

      expect(order).toEqual(['delete', 'refresh']);
      expect(prisma.$executeRaw.mock.calls[0]).toContainEqual([
        'loc_a',
        'loc_b',
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
        makeTrip({ _count: { posts: 1, saves: 0 } }),
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

    it("starts counting the trip's ratings toward its places", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ _count: { posts: 1 } }),
      );
      prisma.trip.update.mockResolvedValue(
        makeTrip({ status: 'published', publishedAt: new Date() }),
      );
      prisma.post.groupBy.mockResolvedValue([{ locationId: 'loc_a' }]);

      await service.publish(owner.id, makeTrip().id);

      expect(prisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tripId: makeTrip().id,
          }) as unknown,
        }),
      );
      expect(prisma.$executeRaw.mock.calls[0]).toContainEqual(['loc_a']);
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
      expect(
        decodeCursor(page.nextCursor!, `trips:${owner.id}`, ['date', 'string']),
      ).toEqual([parseDateOnly('2026-10-12'), 'b']);
    });

    it('starts the next page after the cursor, newest first', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      prisma.trip.findMany.mockResolvedValue([]);
      const startDate = parseDateOnly('2026-10-12');
      const cursor = encodeCursor(`trips:${owner.id}`, [startDate, 'b']);

      await service.listForUser(owner.id, owner.id, { cursor });

      expect(prisma.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ownerId: owner.id,
            OR: [
              { startDate: { lt: startDate } },
              { startDate, id: { lt: 'b' } },
            ],
          },
          orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it("rejects a cursor from another user's trips", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: owner.id });
      const cursor = encodeCursor('trips:user_other', [
        parseDateOnly('2026-10-12'),
        'b',
      ]);
      await expect(
        service.listForUser('user_other', owner.id, { cursor }),
      ).rejects.toThrow('Invalid cursor');
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

  describe('listSaved', () => {
    const tripId = makeTrip().id;

    it("lists only the user's own visible saves, most recent first", async () => {
      prisma.tripSave.findMany.mockResolvedValue([
        { tripId, trip: makeTrip({ saves: [{ userId: 'user_saver' }] }) },
      ]);

      const page = await service.listSaved('user_saver', {});

      expect(prisma.tripSave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user_saver',
            trip: {
              OR: [{ status: 'published' }, { ownerId: 'user_saver' }],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { tripId: 'desc' }],
          take: 21,
        }),
      );
      expect(page.items[0]).toMatchObject({ id: tripId, savedByMe: true });
      expect(page.nextCursor).toBeNull();
    });

    it('starts after the cursor and returns the next one', async () => {
      const savedAt = new Date('2026-10-20T12:00:00Z');
      const cursor = encodeCursor('saved-trips:user_saver', [savedAt, 'a']);
      prisma.tripSave.findMany.mockResolvedValue([
        { tripId: 'b', createdAt: savedAt, trip: makeTrip({ id: 'b' }) },
        { tripId: 'c', createdAt: savedAt, trip: makeTrip({ id: 'c' }) },
      ]);

      const page = await service.listSaved('user_saver', { cursor, limit: 1 });

      const [args] = prisma.tripSave.findMany.mock.calls[0] as [
        { where: { OR: unknown }; orderBy: unknown; take: number },
      ];
      expect(args.where.OR).toEqual([
        { createdAt: { lt: savedAt } },
        { createdAt: savedAt, tripId: { lt: 'a' } },
      ]);
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { tripId: 'desc' }]);
      expect(args.take).toBe(2);
      expect(page.items).toHaveLength(1);
      expect(
        decodeCursor(page.nextCursor!, 'saved-trips:user_saver', [
          'date',
          'string',
        ]),
      ).toEqual([savedAt, 'b']);
    });

    it("rejects a cursor from someone else's list", async () => {
      const cursor = encodeCursor('saved-trips:someone_else', [
        new Date('2026-10-20T12:00:00Z'),
        'a',
      ]);
      await expect(service.listSaved('user_saver', { cursor })).rejects.toThrow(
        'Invalid cursor',
      );
      expect(prisma.tripSave.findMany).not.toHaveBeenCalled();
    });
  });
});
