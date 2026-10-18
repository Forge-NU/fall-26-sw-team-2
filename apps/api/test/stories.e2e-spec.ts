import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoriesCleanupService } from '../src/stories/stories-cleanup.service';
import {
  StoriesFeedResponse,
  StoryResponse,
  TripStoriesResponse,
} from '../src/stories/story.types';
import {
  createTestApp,
  createTestUser,
  isoDate,
  storageMock,
} from './utils/test-app';

// Starting the app against a real database can take longer than Jest's 5s
jest.setTimeout(60_000);

const HOUR_MS = 60 * 60 * 1000;
// The seeded story created 25 hours ago (prisma/seed.ts)
const SEEDED_EXPIRED_STORY_ID = '00000000-0000-4000-c000-000000000004';

describe('Stories (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let other: User;
  // Nobody follows them
  let stranger: User;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'owner');
    other = await createTestUser(prisma, 'other');
    stranger = await createTestUser(prisma, 'stranger');
    // owner and other follow each other
    await prisma.follow.createMany({
      data: [
        { followerId: owner.id, followingId: other.id },
        { followerId: other.id, followingId: owner.id },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id, stranger.id] } },
    });
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const as = (user: User) => ({ 'x-test-user': user.id });
  const key = (user: User) => `users/${user.id}/stories/${randomUUID()}.jpg`;

  // Active by default: a draft with today within its dates
  function createTrip(
    user: User,
    {
      start = -1,
      end = 1,
      published = false,
    }: { start?: number; end?: number; published?: boolean } = {},
  ) {
    return prisma.trip.create({
      data: {
        ownerId: user.id,
        title: 'Test trip',
        destination: 'Somewhere',
        startDate: new Date(isoDate(start)),
        endDate: new Date(isoDate(end)),
        status: published ? 'published' : 'draft',
        publishedAt: published ? new Date() : null,
      },
    });
  }

  // Inserts a story directly, `hoursAgo` hours old, the way the seed does.
  // storyDate defaults to the day it was created.
  function insertStory(
    user: User,
    {
      hoursAgo = 0,
      tripId = null,
      keepOnTrip = false,
      storyDate,
    }: {
      hoursAgo?: number;
      tripId?: string | null;
      keepOnTrip?: boolean;
      storyDate?: string;
    } = {},
  ) {
    const createdAt = new Date(Date.now() - hoursAgo * HOUR_MS);
    return prisma.story.create({
      data: {
        ownerId: user.id,
        tripId,
        keepOnTrip,
        s3Key: key(user),
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 24 * HOUR_MS),
        storyDate: new Date(storyDate ?? createdAt.toISOString().slice(0, 10)),
      },
    });
  }

  function createStory(user: User, body: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/stories')
      .set(as(user))
      .send({ s3Key: key(user), ...body });
  }

  // Every page of the stories bar, as story IDs by owner
  async function readFeed(viewer: User, limit = 50) {
    const byOwner = new Map<string, string[]>();
    let cursor: string | null = null;
    do {
      const res = await request(app.getHttpServer())
        .get('/api/stories/feed')
        .query(cursor ? { limit, cursor } : { limit })
        .set(as(viewer))
        .expect(200);
      const page = res.body as StoriesFeedResponse;
      for (const group of page.items) {
        expect(byOwner.has(group.owner.id)).toBe(false); // each user once
        byOwner.set(
          group.owner.id,
          group.stories.map((s) => s.id),
        );
      }
      cursor = page.nextCursor;
    } while (cursor);
    return byOwner;
  }

  describe('POST /api/stories', () => {
    it('creates a story without a trip that expires in 24 hours', async () => {
      const s3Key = key(owner);
      const res = await createStory(owner, {
        s3Key,
        text: 'Hello',
        customLocationName: 'Somewhere',
      }).expect(201);
      const story = res.body as StoryResponse;

      expect(story).toMatchObject({
        owner: { id: owner.id },
        tripId: null,
        text: 'Hello',
        customLocationName: 'Somewhere',
        location: null,
        keepOnTrip: false,
        imageUrl: `https://s3.test/${s3Key}`,
        storyDate: isoDate(0),
      });
      const lifetime =
        new Date(story.expiresAt).getTime() -
        new Date(story.createdAt).getTime();
      expect(lifetime).toBe(24 * HOUR_MS);
    });

    it('links an active trip and keeps the story on it', async () => {
      const trip = await createTrip(owner);

      const res = await createStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
      }).expect(201);

      expect(res.body).toMatchObject({ tripId: trip.id, keepOnTrip: true });
    });

    it('rejects a published trip, even when today is within its dates', async () => {
      const trip = await createTrip(owner, { published: true });

      await createStory(owner, { tripId: trip.id }).expect(400);
    });

    it("rejects a draft trip whose dates don't include today", async () => {
      const past = await createTrip(owner, { start: -5, end: -2 });
      const future = await createTrip(owner, { start: 2, end: 5 });

      await createStory(owner, { tripId: past.id }).expect(400);
      await createStory(owner, { tripId: future.id }).expect(400);
    });

    it("rejects someone else's trip", async () => {
      const trip = await createTrip(other);

      await createStory(owner, { tripId: trip.id }).expect(404);
    });

    it('rejects keepOnTrip without a trip, and a key that is not theirs', async () => {
      await createStory(owner, { keepOnTrip: true }).expect(400);
      await createStory(owner, { s3Key: key(other) }).expect(400);
    });

    it('rejects a key that is already used', async () => {
      const s3Key = key(owner);
      await createStory(owner, { s3Key }).expect(201);

      await createStory(owner, { s3Key }).expect(400);
    });

    it('rejects text over 200 characters', async () => {
      await createStory(owner, { text: 'a'.repeat(201) }).expect(400);
    });

    it("takes a storyDate within the trip's dates, but not in the future", async () => {
      const trip = await createTrip(owner, { start: -3, end: 2 });

      const res = await createStory(owner, {
        tripId: trip.id,
        storyDate: isoDate(-3),
      }).expect(201);
      expect((res.body as StoryResponse).storyDate).toBe(isoDate(-3));

      await createStory(owner, {
        tripId: trip.id,
        storyDate: isoDate(-4),
      }).expect(400);
      await createStory(owner, {
        tripId: trip.id,
        storyDate: isoDate(1),
      }).expect(400);
    });

    it('only takes today as the storyDate without a trip', async () => {
      await createStory(owner, { storyDate: isoDate(-1) }).expect(400);
      await createStory(owner, { storyDate: isoDate(0) }).expect(201);
    });
  });

  describe('database constraints', () => {
    it('rejects keep_on_trip without a trip', async () => {
      await expect(
        prisma.story.create({
          data: {
            ownerId: owner.id,
            s3Key: key(owner),
            keepOnTrip: true,
            storyDate: new Date(isoDate(0)),
          },
        }),
      ).rejects.toThrow(/stories_keep_on_trip_check/);
    });

    it('deletes stories with their trip', async () => {
      const trip = await createTrip(owner);
      const story = await insertStory(owner, { tripId: trip.id });

      await prisma.trip.delete({ where: { id: trip.id } });

      await expect(
        prisma.story.findUnique({ where: { id: story.id } }),
      ).resolves.toBeNull();
    });

    it('deleting a trip through the API also deletes its stories and their S3 objects', async () => {
      const trip = await createTrip(owner);
      const kept = await insertStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
      });
      const active = await insertStory(owner, { tripId: trip.id });

      await request(app.getHttpServer())
        .delete(`/api/trips/${trip.id}`)
        .set(as(owner))
        .expect(204);

      const left = await prisma.story.count({
        where: { id: { in: [kept.id, active.id] } },
      });
      expect(left).toBe(0);
      const deletedKeys = storageMock.deleteObjects.mock.calls.flat(2);
      expect(deletedKeys).toEqual(
        expect.arrayContaining([kept.s3Key, active.s3Key]),
      );
    });

    it('deletes stories with their owner', async () => {
      const user = await createTestUser(prisma, 'leaving');
      const story = await insertStory(user);

      await prisma.user.delete({ where: { id: user.id } });

      await expect(
        prisma.story.findUnique({ where: { id: story.id } }),
      ).resolves.toBeNull();
    });
  });

  describe('GET /api/stories/feed', () => {
    it('never shows a story created 25 hours ago', async () => {
      const expired = await insertStory(owner, { hoursAgo: 25 });
      const active = await insertStory(owner, { hoursAgo: 23 });

      const feed = await readFeed(other);

      expect(feed.get(owner.id)).toContain(active.id);
      expect(feed.get(owner.id)).not.toContain(expired.id);
      // Nor the seeded one, if the database was seeded
      const allIds = [...feed.values()].flat();
      expect(allIds).not.toContain(SEEDED_EXPIRED_STORY_ID);
      expect(allIds).not.toContain(expired.id);
    });

    it('shows the viewer and the users they follow, and nobody else', async () => {
      const mine = await insertStory(owner);
      const followed = await insertStory(other);
      const strangers = await insertStory(stranger);

      const feed = await readFeed(owner);

      expect(feed.get(owner.id)).toContain(mine.id);
      expect(feed.get(other.id)).toContain(followed.id);
      expect(feed.has(stranger.id)).toBe(false);
      expect([...feed.values()].flat()).not.toContain(strangers.id);
      // The stranger still sees their own
      expect((await readFeed(stranger)).get(stranger.id)).toContain(
        strangers.id,
      );
    });

    it("lists each user's stories oldest first", async () => {
      const older = await insertStory(other, { hoursAgo: 2 });
      const newer = await insertStory(other, { hoursAgo: 1 });

      const ids = (await readFeed(owner)).get(other.id) ?? [];

      expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
    });

    it('pages through users with a cursor', async () => {
      // A page size of 1 makes every user a page, which exercises the cursor
      const paged = await readFeed(owner, 1);
      const unpaged = await readFeed(owner, 50);

      expect([...paged.keys()]).toEqual([...unpaged.keys()]);
    });

    it('rejects a bad cursor', async () => {
      await request(app.getHttpServer())
        .get('/api/stories/feed')
        .query({ cursor: 'garbage' })
        .set(as(owner))
        .expect(400);
    });
  });

  describe('GET /api/trips/:id/stories', () => {
    it('keeps a kept story on the trip after it expires, and drops the rest', async () => {
      const trip = await createTrip(owner, { published: true });
      const kept = await insertStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
        hoursAgo: 30,
      });
      await insertStory(owner, { tripId: trip.id, hoursAgo: 1 });

      const res = await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}/stories`)
        .set(as(other))
        .expect(200);

      const page = res.body as TripStoriesResponse;
      expect(page.items.map((s) => s.id)).toEqual([kept.id]);
    });

    it('orders kept stories by storyDate, not by when they were posted', async () => {
      const trip = await createTrip(owner, { start: -3, end: 1 });
      // Posted first, but from a later day of the trip
      const later = await insertStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
        hoursAgo: 2,
        storyDate: isoDate(0),
      });
      const earlier = await insertStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
        hoursAgo: 1,
        storyDate: isoDate(-2),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}/stories`)
        .set(as(owner))
        .expect(200);

      expect((res.body as TripStoriesResponse).items.map((s) => s.id)).toEqual([
        earlier.id,
        later.id,
      ]);
    });

    it("hides a draft trip's stories from everyone but the owner", async () => {
      const trip = await createTrip(owner);
      await insertStory(owner, { tripId: trip.id, keepOnTrip: true });

      await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}/stories`)
        .set(as(other))
        .expect(404);
      const res = await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}/stories`)
        .set(as(owner))
        .expect(200);
      expect((res.body as TripStoriesResponse).items).toHaveLength(1);
    });
  });

  describe('DELETE /api/stories/:id', () => {
    it('deletes the row and the S3 object', async () => {
      const story = await insertStory(owner);

      await request(app.getHttpServer())
        .delete(`/api/stories/${story.id}`)
        .set(as(owner))
        .expect(204);

      await expect(
        prisma.story.findUnique({ where: { id: story.id } }),
      ).resolves.toBeNull();
      expect(storageMock.deleteObjects).toHaveBeenCalledWith([story.s3Key]);
    });

    it("returns 404 to anyone but the owner and doesn't delete", async () => {
      const story = await insertStory(owner);

      await request(app.getHttpServer())
        .delete(`/api/stories/${story.id}`)
        .set(as(other))
        .expect(404);

      await expect(
        prisma.story.findUnique({ where: { id: story.id } }),
      ).resolves.not.toBeNull();
      expect(storageMock.deleteObjects).not.toHaveBeenCalled();
    });
  });

  describe('cleanup job', () => {
    it('removes expired stories that were not kept, with their S3 objects', async () => {
      const trip = await createTrip(owner);
      const expired = await insertStory(owner, { hoursAgo: 25 });
      const kept = await insertStory(owner, {
        hoursAgo: 25,
        tripId: trip.id,
        keepOnTrip: true,
      });
      const active = await insertStory(owner, { hoursAgo: 1 });

      const deleted = await app.get(StoriesCleanupService).deleteExpired();

      expect(deleted).toBeGreaterThanOrEqual(1);
      await expect(
        prisma.story.findUnique({ where: { id: expired.id } }),
      ).resolves.toBeNull();
      const deletedKeys = storageMock.deleteObjects.mock.calls.flat(2);
      expect(deletedKeys).toContain(expired.s3Key);

      // Kept and active stories stay, and so do their objects
      await expect(
        prisma.story.findUnique({ where: { id: kept.id } }),
      ).resolves.not.toBeNull();
      await expect(
        prisma.story.findUnique({ where: { id: active.id } }),
      ).resolves.not.toBeNull();
      expect(deletedKeys).not.toContain(kept.s3Key);
      expect(deletedKeys).not.toContain(active.s3Key);
    });

    it('deletes in batches', async () => {
      const stories = await Promise.all(
        [1, 2, 3].map(() => insertStory(owner, { hoursAgo: 26 })),
      );

      await app.get(StoriesCleanupService).deleteExpired(2);

      const left = await prisma.story.count({
        where: { id: { in: stories.map((s) => s.id) } },
      });
      expect(left).toBe(0);
    });
  });
});
