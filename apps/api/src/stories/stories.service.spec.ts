import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { formatDateOnly, todayUtc } from '../common/dates';
import { StoriesService, decodeFeedCursor } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';

const ownerId = 'user_owner';
const otherId = 'user_other';
const tripId = '11111111-1111-4111-8111-111111111111';
const storyId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';

const today = todayUtc();
const daysFromToday = (n: number) =>
  new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

const owner = {
  id: ownerId,
  username: 'owner',
  firstName: 'Olive',
  lastName: 'Owner',
  avatarUrl: null,
};

// Active by default: a draft, with today within its dates
function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: tripId,
    ownerId,
    status: 'draft',
    startDate: daysFromToday(-1),
    endDate: daysFromToday(1),
    ...overrides,
  };
}

function makeStory(overrides: Record<string, unknown> = {}) {
  return {
    id: storyId,
    ownerId,
    tripId: null,
    locationId: null,
    customLocationName: null,
    s3Key: `users/${ownerId}/stories/a.jpg`,
    text: null,
    keepOnTrip: false,
    expiresAt: new Date('2026-10-14T12:00:00Z'),
    createdAt: new Date('2026-10-13T12:00:00Z'),
    owner,
    location: null,
    ...overrides,
  };
}

function createDto(overrides: Partial<CreateStoryDto> = {}): CreateStoryDto {
  return { s3Key: `users/${ownerId}/stories/a.jpg`, ...overrides };
}

describe('StoriesService', () => {
  let service: StoriesService;

  const prisma = {
    trip: { findUnique: jest.fn() },
    story: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    location: { findUnique: jest.fn() },
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
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    // SELECT now() in create, and the trip lock
    prisma.$queryRaw.mockResolvedValue([{ now: new Date() }]);
    prisma.story.create.mockResolvedValue(makeStory());

    const module = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(StoriesService);
  });

  // The data passed to the last story.create call
  function createdData() {
    const calls = prisma.story.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    return calls[calls.length - 1][0].data;
  }

  describe('create', () => {
    it("creates a story without a trip, expiring 24 hours later by the database's clock", async () => {
      const dbNow = new Date('2026-10-17T10:00:00Z');
      prisma.$queryRaw.mockResolvedValue([{ now: dbNow }]);

      const story = await service.create(ownerId, createDto({ text: 'Hi' }));

      expect(createdData()).toEqual({
        createdAt: dbNow,
        expiresAt: new Date('2026-10-18T10:00:00Z'),
        ownerId,
        tripId: null,
        s3Key: `users/${ownerId}/stories/a.jpg`,
        text: 'Hi',
        locationId: null,
        customLocationName: null,
        keepOnTrip: false,
      });
      expect(prisma.trip.findUnique).not.toHaveBeenCalled();
      expect(story.imageUrl).toBe(`https://s3/users/${ownerId}/stories/a.jpg`);
      expect(story.owner).toEqual(owner);
    });

    it('links an active trip, locking it first', async () => {
      await service.create(ownerId, createDto({ tripId, keepOnTrip: true }));

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(createdData()).toMatchObject({ tripId, keepOnTrip: true });
    });

    it('accepts a trip on its first and last day', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ startDate: today, endDate: today }),
      );

      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).resolves.toBeDefined();
    });

    it('rejects a published trip, even within its dates', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );

      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.story.create).not.toHaveBeenCalled();
    });

    it("rejects a trip whose dates don't include today", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ startDate: daysFromToday(1), endDate: daysFromToday(3) }),
      );
      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(BadRequestException);

      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ startDate: daysFromToday(-5), endDate: daysFromToday(-1) }),
      );
      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.story.create).not.toHaveBeenCalled();
    });

    it("uses the user's local date to decide if the trip is active", async () => {
      // Ends yesterday (UTC), but it's still that day where the user is
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ startDate: daysFromToday(-3), endDate: daysFromToday(-1) }),
      );

      await expect(
        service.create(
          ownerId,
          createDto({ tripId, date: formatDateOnly(daysFromToday(-1)) }),
        ),
      ).resolves.toBeDefined();
    });

    it("returns 404 for someone else's draft trip, and 403 for their published one", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip({ ownerId: otherId }));
      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(NotFoundException);

      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ ownerId: otherId, status: 'published' }),
      );
      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(ForbiddenException);
    });

    it("returns 404 for a trip that doesn't exist", async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.create(ownerId, createDto({ tripId })),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects keepOnTrip without a trip', async () => {
      await expect(
        service.create(ownerId, createDto({ keepOnTrip: true })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects both locationId and customLocationName', async () => {
      await expect(
        service.create(
          ownerId,
          createDto({ locationId, customLocationName: 'Somewhere' }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a location that doesn't exist", async () => {
      prisma.location.findUnique.mockResolvedValue(null);

      await expect(
        service.create(ownerId, createDto({ locationId })),
      ).rejects.toThrow('Location not found');
    });

    it.each([
      [`users/${otherId}/stories/a.jpg`, "another user's upload"],
      [`users/${ownerId}/posts/a.jpg`, 'a post upload'],
      [`users/${ownerId}/stories/`, 'the bare prefix'],
      [`users/${ownerId}/stories/../../${otherId}/a.jpg`, 'a path with ..'],
    ])('rejects the key %s (%s)', async (s3Key) => {
      await expect(
        service.create(ownerId, createDto({ s3Key })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a key that is already used by another story', async () => {
      prisma.story.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(ownerId, createDto())).rejects.toThrow(
        'Media key already in use',
      );
    });

    it('stores empty text as null', async () => {
      await service.create(ownerId, createDto({ text: '' }));

      expect(createdData()).toMatchObject({ text: null });
    });
  });

  describe('remove', () => {
    it('deletes the row, then the S3 object', async () => {
      prisma.story.findUnique.mockResolvedValue(makeStory());
      prisma.story.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove(ownerId, storyId);

      expect(prisma.story.deleteMany).toHaveBeenCalledWith({
        where: { id: storyId },
      });
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        `users/${ownerId}/stories/a.jpg`,
      ]);
    });

    it("returns 404 to anyone but the owner, and doesn't delete", async () => {
      prisma.story.findUnique.mockResolvedValue(makeStory());

      await expect(service.remove(otherId, storyId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.story.deleteMany).not.toHaveBeenCalled();
      expect(storage.deleteObjects).not.toHaveBeenCalled();
    });

    it("returns 404 for a story that doesn't exist", async () => {
      prisma.story.findUnique.mockResolvedValue(null);

      await expect(service.remove(ownerId, storyId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('skips S3 when the cleanup job already deleted the row', async () => {
      prisma.story.findUnique.mockResolvedValue(makeStory());
      prisma.story.deleteMany.mockResolvedValue({ count: 0 });

      await service.remove(ownerId, storyId);

      expect(storage.deleteObjects).not.toHaveBeenCalled();
    });
  });

  describe('listFeed', () => {
    const dbNow = new Date('2026-10-14T00:00:00Z');

    it('groups active stories by user, in the order the query returns users', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          owner_id: otherId,
          latest: new Date('2026-10-13T20:00:00Z'),
          now: dbNow,
        },
        {
          owner_id: ownerId,
          latest: new Date('2026-10-13T12:00:00Z'),
          now: dbNow,
        },
      ]);
      const other = { ...owner, id: otherId, username: 'other' };
      prisma.story.findMany.mockResolvedValue([
        makeStory({ id: 's1' }),
        makeStory({ id: 's2', ownerId: otherId, owner: other }),
        makeStory({ id: 's3' }),
      ]);

      const page = await service.listFeed({});

      expect(page.items.map((g) => g.owner.id)).toEqual([otherId, ownerId]);
      expect(page.items[1].stories.map((s) => s.id)).toEqual(['s1', 's3']);
      expect(page.nextCursor).toBeNull();
      // Filtered on the database's clock
      expect(prisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ownerId: { in: [otherId, ownerId] },
            expiresAt: { gt: dbNow },
          },
        }),
      );
    });

    it('returns a cursor when there are more users', async () => {
      const latest = new Date('2026-10-13T12:00:00Z');
      prisma.$queryRaw.mockResolvedValue([
        { owner_id: ownerId, latest, now: dbNow },
        { owner_id: otherId, latest, now: dbNow },
      ]);
      prisma.story.findMany.mockResolvedValue([makeStory()]);

      const page = await service.listFeed({ limit: 1 });

      expect(page.items).toHaveLength(1);
      expect(decodeFeedCursor(page.nextCursor!)).toEqual({
        latest,
        ownerId,
      });
    });

    it('returns an empty page without a second query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.listFeed({})).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
      expect(prisma.story.findMany).not.toHaveBeenCalled();
    });

    it('drops a user whose last story expired between the two queries', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { owner_id: ownerId, latest: dbNow, now: dbNow },
      ]);
      prisma.story.findMany.mockResolvedValue([]);

      const page = await service.listFeed({});

      expect(page.items).toEqual([]);
    });

    it('rejects a cursor it did not make', async () => {
      await expect(service.listFeed({ cursor: 'nope' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.listFeed({
          cursor: Buffer.from('["not a date","x"]').toString('base64url'),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listForTrip', () => {
    it('lists kept stories on a trip the viewer can see', async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      prisma.story.findMany.mockResolvedValue([
        makeStory({ tripId, keepOnTrip: true }),
      ]);

      const page = await service.listForTrip(otherId, tripId, {});

      expect(page.items).toHaveLength(1);
      expect(prisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tripId, keepOnTrip: true } }),
      );
    });

    it("returns 404 for someone else's draft trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());

      await expect(service.listForTrip(otherId, tripId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets the owner see kept stories on their draft', async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.story.findMany.mockResolvedValue([]);

      await expect(service.listForTrip(ownerId, tripId, {})).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it("rejects a cursor that isn't a kept story on this trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.story.findFirst.mockResolvedValue(null);

      await expect(
        service.listForTrip(ownerId, tripId, { cursor: storyId }),
      ).rejects.toThrow('Invalid cursor');
    });
  });
});
