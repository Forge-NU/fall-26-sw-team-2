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
    _count: { likes: 0, saves: 0, comments: 0 },
    likes: [],
    saves: [],
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
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    postMedia: { findMany: jest.fn(), deleteMany: jest.fn() },
    postSave: { findFirst: jest.fn(), findMany: jest.fn() },
    location: { findUnique: jest.fn() },
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
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    prisma.postMedia.findMany.mockResolvedValue([]);
    prisma.post.create.mockResolvedValue(makePost());
    prisma.post.update.mockResolvedValue(makePost());
    prisma.post.findUniqueOrThrow.mockResolvedValue(makePost());
    // Row locks; the post lock also reads the post's location and rating
    prisma.$queryRaw.mockResolvedValue([{ location_id: null, rating: null }]);

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

    it('saves a rating on a Mapbox place and refreshes its rating', async () => {
      prisma.location.findUnique.mockResolvedValue({ id: locationId });
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      await service.create(
        ownerId,
        createDto({ customLocationName: undefined, locationId, rating: 4 }),
      );
      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ locationId, rating: 4 }) as unknown,
        }),
      );
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      // Read back after the refresh, so the place's rating is current
      expect(prisma.post.findUniqueOrThrow).toHaveBeenCalled();
    });

    it("doesn't refresh the place for a post that can't count toward it", async () => {
      prisma.location.findUnique.mockResolvedValue({ id: locationId });
      // Unrated, in a published trip
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      await service.create(
        ownerId,
        createDto({ customLocationName: undefined, locationId }),
      );
      // Rated, in a draft
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      await service.create(
        ownerId,
        createDto({ customLocationName: undefined, locationId, rating: 4 }),
      );

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      // The created post is returned as is, with no second read
      expect(prisma.post.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('rejects a rating on a custom location', async () => {
      await expect(
        service.create(ownerId, createDto({ rating: 4 })),
      ).rejects.toThrow('Only posts at a Mapbox place can be rated');
      expect(prisma.post.create).not.toHaveBeenCalled();
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

  describe('findManyForViewer', () => {
    it('loads every id in one query and leaves out posts you cannot see', async () => {
      const visible = makePost({
        trip: { ...makeTrip(), status: 'published', owner },
      });
      const inOthersDraft = makePost({
        id: '99999999-9999-4999-8999-999999999999',
        trip: { ...makeTrip(), status: 'draft', owner },
      });
      prisma.post.findMany.mockResolvedValue([visible, inOthersDraft]);

      const posts = await service.findManyForViewer('user_other', [
        visible.id,
        inOthersDraft.id,
      ]);

      expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
      expect([...posts.keys()]).toEqual([visible.id]);
      expect(posts.get(visible.id)?.media[0].url).toBe(
        `https://s3/users/${ownerId}/posts/a.jpg`,
      );
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

    describe('rating', () => {
      // The locked post is at a place, rated 4 unless given
      const ratedPlace = (rating: number | null = 4) =>
        prisma.$queryRaw.mockResolvedValue([
          { location_id: locationId, rating },
        ]);

      beforeEach(() => {
        prisma.trip.findUnique.mockResolvedValue(
          makeTrip({ status: 'published' }),
        );
      });

      it('sets and clears the rating, refreshing the place', async () => {
        ratedPlace();
        await service.update(ownerId, postId, { rating: 5 });
        await service.update(ownerId, postId, { rating: null });

        const data = prisma.post.update.mock.calls.map(
          ([args]: [{ data: { rating?: number | null } }]) => args.data.rating,
        );
        expect(data).toEqual([5, null]);
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      });

      it('refreshes both the old and the new place when the post moves', async () => {
        const newLocationId = '44444444-4444-4444-8444-444444444444';
        ratedPlace();
        prisma.location.findUnique.mockResolvedValue({ id: newLocationId });

        await service.update(ownerId, postId, { locationId: newLocationId });

        expect(prisma.$executeRaw.mock.calls[0]).toContainEqual(
          [locationId, newLocationId].sort(),
        );
      });

      it('clears the rating when switching to a custom location', async () => {
        ratedPlace();
        await service.update(ownerId, postId, { customLocationName: 'Home' });
        expect(prisma.post.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              locationId: null,
              customLocationName: 'Home',
              rating: null,
            }) as unknown,
          }),
        );
        expect(prisma.$executeRaw.mock.calls[0]).toContainEqual([locationId]);
      });

      it('rejects a rating sent with a custom location', async () => {
        await expect(
          service.update(ownerId, postId, {
            customLocationName: 'Home',
            rating: 3,
          }),
        ).rejects.toThrow('Only posts at a Mapbox place can be rated');
      });

      it('rejects a rating on a post that has a custom location', async () => {
        // The locked row has no location_id (the default mock)
        await expect(
          service.update(ownerId, postId, { rating: 3 }),
        ).rejects.toThrow('Only posts at a Mapbox place can be rated');
        expect(prisma.post.update).not.toHaveBeenCalled();
      });

      it("doesn't refresh the place for an edit that can't change it", async () => {
        ratedPlace();
        await service.update(ownerId, postId, { caption: 'New caption' });
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
      });

      it('refreshes the place for a first rating', async () => {
        ratedPlace(null);
        await service.update(ownerId, postId, { rating: 3 });
        expect(prisma.$executeRaw.mock.calls[0]).toContainEqual([locationId]);
      });

      it("doesn't refresh when an unrated post moves", async () => {
        const newLocationId = '44444444-4444-4444-8444-444444444444';
        ratedPlace(null);
        prisma.location.findUnique.mockResolvedValue({ id: newLocationId });

        await service.update(ownerId, postId, { locationId: newLocationId });
        await service.update(ownerId, postId, { customLocationName: 'Home' });

        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        expect(prisma.post.findUniqueOrThrow).not.toHaveBeenCalled();
      });

      it("doesn't refresh for a rating in a draft trip", async () => {
        prisma.trip.findUnique.mockResolvedValue(makeTrip());
        ratedPlace();
        await service.update(ownerId, postId, { rating: 5 });
        await service.update(ownerId, postId, { rating: null });
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
      });

      it("404s if the post was deleted before it's locked", async () => {
        prisma.$queryRaw
          .mockResolvedValueOnce([{ id: 'trip' }]) // trip lock
          .mockResolvedValueOnce([]); // post lock
        await expect(
          service.update(ownerId, postId, { rating: 5 }),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.post.update).not.toHaveBeenCalled();
      });
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

    it("refreshes the place's rating after the post is gone", async () => {
      prisma.post.findUnique.mockResolvedValue(makePost());
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      prisma.$queryRaw.mockResolvedValue([
        { location_id: locationId, rating: 4 },
      ]);
      const order: string[] = [];
      prisma.post.deleteMany.mockImplementation(() => {
        order.push('delete');
        return Promise.resolve({ count: 1 });
      });
      prisma.$executeRaw.mockImplementation(() => {
        order.push('refresh');
        return Promise.resolve(1);
      });

      await service.remove(ownerId, postId);

      expect(order).toEqual(['delete', 'refresh']);
      expect(prisma.$executeRaw.mock.calls[0]).toContainEqual([locationId]);
    });

    it("doesn't refresh the place for a post that didn't count toward it", async () => {
      prisma.post.findUnique.mockResolvedValue(makePost());
      // Unrated, in a published trip
      prisma.trip.findUnique.mockResolvedValue(
        makeTrip({ status: 'published' }),
      );
      prisma.$queryRaw.mockResolvedValue([
        { location_id: locationId, rating: null },
      ]);
      await service.remove(ownerId, postId);
      // Rated, in a draft
      prisma.trip.findUnique.mockResolvedValue(makeTrip());
      prisma.$queryRaw.mockResolvedValue([
        { location_id: locationId, rating: 4 },
      ]);
      await service.remove(ownerId, postId);

      expect(prisma.post.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it("404s if the post was deleted before it's locked", async () => {
      prisma.post.findUnique.mockResolvedValue(makePost());
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'trip' }]) // trip lock
        .mockResolvedValueOnce([]); // post lock
      await expect(service.remove(ownerId, postId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.post.deleteMany).not.toHaveBeenCalled();
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

  describe('counts and viewer flags', () => {
    it("returns like and save counts and whether you've liked or saved it", async () => {
      prisma.post.findUnique.mockResolvedValue(
        makePost({
          _count: { likes: 7, saves: 2, comments: 5 },
          likes: [{ userId: ownerId }],
          saves: [],
        }),
      );

      const post = await service.findOne(ownerId, postId);

      const [args] = prisma.post.findUnique.mock.calls[0] as [
        { include: Record<string, unknown> },
      ];
      expect(args.include).toMatchObject({
        _count: { select: { likes: true, saves: true, comments: true } },
        likes: { where: { userId: ownerId }, select: { userId: true } },
        saves: { where: { userId: ownerId }, select: { userId: true } },
      });
      expect(post).toMatchObject({
        likeCount: 7,
        saveCount: 2,
        commentCount: 5,
        likedByMe: true,
        savedByMe: false,
      });
    });
  });

  describe('listSaved', () => {
    it("lists only the user's own visible saves, most recent first", async () => {
      prisma.postSave.findMany.mockResolvedValue([
        { postId, post: makePost({ saves: [{ userId: 'user_saver' }] }) },
      ]);

      const page = await service.listSaved('user_saver', {});

      expect(prisma.postSave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user_saver',
            post: {
              trip: {
                OR: [{ status: 'published' }, { ownerId: 'user_saver' }],
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
        }),
      );
      expect(page.items[0]).toMatchObject({ id: postId, savedByMe: true });
      expect(page.nextCursor).toBeNull();
    });

    it('pages by post ID within your own saves', async () => {
      prisma.postSave.findFirst.mockResolvedValue({ postId });
      prisma.postSave.findMany.mockResolvedValue([
        { postId, post: makePost() },
        { postId: 'next', post: makePost({ id: 'next' }) },
      ]);

      const page = await service.listSaved('user_saver', {
        cursor: postId,
        limit: 1,
      });

      expect(prisma.postSave.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { userId_postId: { userId: 'user_saver', postId } },
          skip: 1,
          take: 2,
        }),
      );
      expect(page.nextCursor).toBe(postId);
    });

    it("rejects a cursor that isn't one of your saves", async () => {
      prisma.postSave.findFirst.mockResolvedValue(null);
      await expect(
        service.listSaved('user_saver', { cursor: postId }),
      ).rejects.toThrow('Invalid cursor');
    });
  });
});
