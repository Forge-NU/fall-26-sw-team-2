import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TripsService } from '../trips/trips.service';
import { parseDateOnly } from '../common/dates';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

const ownerId = 'user_owner';
const tripId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';

const owner = {
  id: ownerId,
  username: 'owner',
  firstName: 'Olive',
  lastName: 'Owner',
  avatarUrl: null,
};

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: tripId,
    ownerId,
    status: 'draft',
    startDate: parseDateOnly('2026-10-12'),
    endDate: parseDateOnly('2026-10-16'),
    ...overrides,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    tripId,
    locationId: null,
    customLocationName: 'Somewhere',
    caption: null,
    visitedOn: parseDateOnly('2026-10-13'),
    createdAt: new Date('2026-10-13T12:00:00Z'),
    updatedAt: new Date('2026-10-13T12:00:00Z'),
    trip: { ...makeTrip(), owner },
    location: null,
    media: [
      {
        id: 'm1',
        s3Key: `users/${ownerId}/posts/a.jpg`,
        mediaType: 'image',
        position: 0,
        width: 1080,
        height: 1350,
        durationMs: null,
      },
    ],
    ...overrides,
  };
}

const media = (...names: string[]) =>
  names.map((name) => ({
    s3Key: `users/${ownerId}/posts/${name}.jpg`,
    mediaType: 'image' as const,
  }));

function createDto(overrides: Partial<CreatePostDto> = {}): CreatePostDto {
  return {
    tripId,
    visitedOn: '2026-10-13',
    customLocationName: 'Somewhere',
    media: media('a'),
    ...overrides,
  };
}

describe('PostsService', () => {
  let service: PostsService;

  const prisma = {
    trip: { findUnique: jest.fn() },
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    postMedia: { findMany: jest.fn(), deleteMany: jest.fn() },
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
    prisma.postMedia.findMany.mockResolvedValue([]);
    prisma.post.create.mockResolvedValue(makePost());
    prisma.post.update.mockResolvedValue(makePost());

    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        TripsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(PostsService);
  });

  describe('create', () => {
    it('creates a post with media in the order given', async () => {
      const post = await service.create(
        ownerId,
        createDto({ media: media('a', 'b') }),
      );

      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId,
            visitedOn: parseDateOnly('2026-10-13'),
            locationId: null,
            customLocationName: 'Somewhere',
            media: {
              create: [
                expect.objectContaining({
                  s3Key: media('a')[0].s3Key,
                  position: 0,
                }),
                expect.objectContaining({
                  s3Key: media('b')[0].s3Key,
                  position: 1,
                }),
              ],
            },
          }) as unknown,
        }),
      );
      expect(post).toMatchObject({
        author: owner,
        visitedOn: '2026-10-13',
        media: [{ url: `https://s3/users/${ownerId}/posts/a.jpg` }],
      });
    });

    it("returns 403 when adding to someone else's published trip", async () => {
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      await expect(service.create('user_other', createDto())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it("returns 404 when adding to someone else's draft", async () => {
      await expect(service.create('user_other', createDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('checks the date against the trip as it is inside the lock', async () => {
      // Dates moved between the ownership check and the insert
      prisma.trip.findUnique
        .mockResolvedValueOnce(makeTrip())
        .mockResolvedValueOnce(
          makeTrip({ startDate: parseDateOnly('2026-10-14') }),
        );
      await expect(service.create(ownerId, createDto())).rejects.toThrow(
        "visitedOn must be within the trip's dates",
      );
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("rejects a date outside the trip's dates", async () => {
      for (const visitedOn of ['2026-10-11', '2026-10-17']) {
        await expect(
          service.create(ownerId, createDto({ visitedOn })),
        ).rejects.toThrow(BadRequestException);
      }
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('requires exactly one of locationId and customLocationName', async () => {
      await expect(
        service.create(ownerId, createDto({ customLocationName: undefined })),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(ownerId, createDto({ locationId })),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a location that doesn't exist", async () => {
      prisma.location.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          ownerId,
          createDto({ locationId, customLocationName: undefined }),
        ),
      ).rejects.toThrow('Location not found');
    });

    describe('media keys', () => {
      const rejects = (keys: string[]) =>
        expect(
          service.create(
            ownerId,
            createDto({
              media: keys.map((s3Key) => ({ s3Key, mediaType: 'image' })),
            }),
          ),
        ).rejects.toThrow(BadRequestException);

      it('requires a duration on videos and rejects one on images', async () => {
        const create = (item: Record<string, unknown>) =>
          service.create(
            ownerId,
            createDto({
              media: [
                {
                  s3Key: `users/${ownerId}/posts/v.mp4`,
                  mediaType: 'video',
                  ...item,
                },
              ],
            }),
          );

        await expect(create({ mediaType: 'video' })).rejects.toThrow(
          'Videos need a durationMs',
        );
        await expect(
          create({ mediaType: 'image', durationMs: 1000 }),
        ).rejects.toThrow("Images can't have a durationMs");
        await expect(
          create({ mediaType: 'video', durationMs: 12000 }),
        ).resolves.toBeDefined();
      });

      it("rejects someone else's upload", async () => {
        await rejects(['users/user_other/posts/a.jpg']);
      });

      it('rejects keys outside the posts prefix', async () => {
        await rejects([`users/${ownerId}/avatars/a.jpg`]);
        await rejects([`users/${ownerId}/posts/`]);
        await rejects([`users/${ownerId}/posts/../../user_other/posts/a.jpg`]);
        await rejects(['a.jpg']);
      });

      it('rejects the same key twice', async () => {
        await rejects([
          `users/${ownerId}/posts/a.jpg`,
          `users/${ownerId}/posts/a.jpg`,
        ]);
      });

      it('rejects a key that already belongs to a post', async () => {
        prisma.postMedia.findMany.mockResolvedValue([
          { s3Key: `users/${ownerId}/posts/a.jpg` },
        ]);
        await rejects([`users/${ownerId}/posts/a.jpg`]);
      });

      it('never creates the post when a key is rejected', async () => {
        await rejects(['users/user_other/posts/a.jpg']);
        expect(prisma.post.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('findOne', () => {
    it("returns 404 for a post in someone else's draft", async () => {
      prisma.post.findUnique.mockResolvedValue(makePost());
      await expect(service.findOne('user_other', postId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a post in a published trip to anyone', async () => {
      prisma.post.findUnique.mockResolvedValue(
        makePost({ trip: { ...makeTrip({ status: 'published' }), owner } }),
      );
      await expect(
        service.findOne('user_other', postId),
      ).resolves.toMatchObject({ id: postId });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.post.findUnique.mockResolvedValue(makePost());
    });

    it("returns 403 for a post in someone else's published trip", async () => {
      prisma.post.findUnique.mockResolvedValue(
        makePost({ trip: { ...makeTrip({ status: 'published' }), owner } }),
      );
      await expect(
        service.update('user_other', postId, { caption: 'Mine' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('replaces the media and deletes removed objects', async () => {
      prisma.postMedia.findMany
        .mockResolvedValueOnce([]) // keys in use on other posts
        .mockResolvedValueOnce([{ s3Key: `users/${ownerId}/posts/a.jpg` }]);

      await service.update(ownerId, postId, { media: media('b') });

      expect(prisma.postMedia.deleteMany).toHaveBeenCalledWith({
        where: { postId },
      });
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        `users/${ownerId}/posts/a.jpg`,
      ]);
    });

    it('locks the trip and post, and bumps updatedAt for a media-only edit', async () => {
      await service.update(ownerId, postId, { media: media('a') });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            updatedAt: expect.any(Date) as Date,
          }) as unknown,
        }),
      );
    });

    it('lets a post keep its own media keys', async () => {
      await service.update(ownerId, postId, { media: media('a', 'b') });
      expect(prisma.postMedia.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            postId: { not: postId },
          }) as unknown,
        }),
      );
      expect(storage.deleteObjects).toHaveBeenCalledWith([]);
    });

    it('switching to a Mapbox place clears the custom name', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: locationId });
      await service.update(ownerId, postId, { locationId });
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationId,
            customLocationName: null,
          }) as unknown,
        }),
      );
    });

    it('rejects both location fields at once', async () => {
      await expect(
        service.update(ownerId, postId, {
          locationId,
          customLocationName: 'Somewhere',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a new date outside the trip's dates", async () => {
      await expect(
        service.update(ownerId, postId, { visitedOn: '2026-10-20' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.post.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the post, then its S3 objects', async () => {
      prisma.post.findUnique.mockResolvedValue(makePost());
      prisma.postMedia.findMany.mockResolvedValue([
        { s3Key: `users/${ownerId}/posts/a.jpg` },
      ]);

      await service.remove(ownerId, postId);

      expect(prisma.post.deleteMany).toHaveBeenCalledWith({
        where: { id: postId },
      });
      expect(storage.deleteObjects).toHaveBeenCalledWith([
        `users/${ownerId}/posts/a.jpg`,
      ]);
    });
  });

  describe('listForTrip', () => {
    it("returns 404 for someone else's draft", async () => {
      await expect(
        service.listForTrip('user_other', tripId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a cursor from another trip', async () => {
      prisma.post.findFirst.mockResolvedValue(null);
      await expect(
        service.listForTrip(ownerId, tripId, { cursor: postId }),
      ).rejects.toThrow('Invalid cursor');
      expect(prisma.post.findFirst).toHaveBeenCalledWith({
        where: { id: postId, tripId },
        select: { id: true },
      });
    });

    it('lists posts in trip order', async () => {
      prisma.post.findMany.mockResolvedValue([makePost()]);
      const page = await service.listForTrip(ownerId, tripId, {});
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId },
          orderBy: [{ visitedOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(page.nextCursor).toBeNull();
    });
  });

  describe('listForTrips', () => {
    it('groups posts by trip, in trip order', async () => {
      const otherTripId = '44444444-4444-4444-8444-444444444444';
      prisma.post.findMany.mockResolvedValue([
        makePost({ id: 'p1' }),
        makePost({ id: 'p2', tripId: otherTripId }),
        makePost({ id: 'p3' }),
      ]);

      const byTrip = await service.listForTrips([tripId, otherTripId]);

      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: { in: [tripId, otherTripId] } },
          orderBy: [{ visitedOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(byTrip.get(tripId)?.map((post) => post.id)).toEqual(['p1', 'p3']);
      expect(byTrip.get(otherTripId)?.map((post) => post.id)).toEqual(['p2']);
    });
  });
});
