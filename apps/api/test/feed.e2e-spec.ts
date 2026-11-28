import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type { FeedResponse } from 'shared-types';
import { Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

describe('Feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let viewer: User;
  let friend: User;
  let stranger: User;
  let loner: User;
  // The friend's published trips, older first
  let older: Trip;
  let newer: Trip;
  let draft: Trip;
  let strangers: Trip;
  let joined: Trip;

  const as = (user: User) => ({ 'x-test-user': user.id });
  const http = () => request(app.getHttpServer());

  // Media keys are unique across the table, so each run gets its own
  const run = randomUUID().slice(0, 8);
  const mediaKey = (caption: string) => `test/feed-${run}/${caption}.jpg`;
  const mediaUrl = (caption: string) => `https://s3.test/${mediaKey(caption)}`;

  function createTrip(
    owner: User,
    title: string,
    publishedAt: Date | null,
  ): Promise<Trip> {
    return prisma.trip.create({
      data: {
        ownerId: owner.id,
        title,
        destination: 'Lisbon, Portugal',
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-16'),
        status: publishedAt ? 'published' : 'draft',
        publishedAt,
      },
    });
  }

  function createPost(tripId: string, visitedOn: string, caption: string) {
    return prisma.post.create({
      data: {
        tripId,
        visitedOn: new Date(visitedOn),
        caption,
        customLocationName: 'Somewhere',
        media: {
          create: {
            s3Key: mediaKey(caption),
            mediaType: 'image',
            position: 0,
          },
        },
      },
    });
  }

  async function feed(user: User, query: Record<string, string | number> = {}) {
    const res = await http()
      .get('/api/feed')
      .query(query)
      .set(as(user))
      .expect(200);
    return res.body as FeedResponse;
  }

  const titles = (page: FeedResponse) => page.items.map((i) => i.trip.title);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    viewer = await createTestUser(prisma, 'feedviewer');
    friend = await createTestUser(prisma, 'feedfriend');
    stranger = await createTestUser(prisma, 'feedstranger');
    loner = await createTestUser(prisma, 'feedloner');

    await prisma.follow.create({
      data: { followerId: viewer.id, followingId: friend.id },
    });

    older = await createTrip(friend, 'older', new Date('2026-10-01T10:00:00Z'));
    newer = await createTrip(friend, 'newer', new Date('2026-10-05T10:00:00Z'));
    draft = await createTrip(friend, 'draft', null);
    strangers = await createTrip(
      stranger,
      'strangers',
      new Date('2026-10-06T10:00:00Z'),
    );
    // A stranger's trip the friend collaborates on
    joined = await createTrip(
      stranger,
      'joined',
      new Date('2026-10-07T10:00:00Z'),
    );
    await prisma.tripMember.create({
      data: { tripId: joined.id, userId: friend.id },
    });

    // Added out of order, to check posts come back in trip order
    await createPost(older.id, '2026-09-14', 'older-day3');
    await createPost(older.id, '2026-09-12', 'older-day1');
    await createPost(newer.id, '2026-09-13', 'newer-day2');
    await createPost(draft.id, '2026-09-13', 'draft-post');
    await createPost(strangers.id, '2026-09-13', 'stranger-post');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [viewer.id, friend.id, stranger.id, loner.id] } },
    });
    await app.close();
  });

  it('requires sign-in', async () => {
    await http().get('/api/feed').expect(401);
  });

  it('is an empty page, not an error, for a user who follows nobody', async () => {
    await expect(feed(loner)).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("shows followed users' published trips, newest publish first", async () => {
    const page = await feed(viewer);
    expect(titles(page)).toEqual(['newer', 'older']);
    expect(page.nextCursor).toBeNull();
  });

  it("leaves out drafts, unfollowed users' trips and trips friends only joined", async () => {
    const page = await feed(viewer);
    const ids = page.items.map((i) => i.trip.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(strangers.id);
    expect(ids).not.toContain(joined.id);
    const captions = page.items.flatMap((i) => i.posts.map((p) => p.caption));
    expect(captions).not.toContain('draft-post');
    expect(captions).not.toContain('stranger-post');
  });

  it('includes everything a trip card needs in one response', async () => {
    const page = await feed(viewer);
    const card = page.items.find((i) => i.trip.id === older.id)!;
    expect(card.trip).toMatchObject({
      title: 'older',
      status: 'published',
      postCount: 2,
      owner: { id: friend.id },
      coverImageUrl: mediaUrl('older-day1'),
    });
    // One post a day here (each has the day's place and image), in trip
    // order, with media, location and counts
    expect(card.posts.map((p) => p.caption)).toEqual([
      'older-day1',
      'older-day3',
    ]);
    expect(card.posts[0]).toMatchObject({
      author: { id: friend.id },
      customLocationName: 'Somewhere',
      media: [{ url: mediaUrl('older-day1') }],
      likeCount: 0,
      saveCount: 0,
      commentCount: 0,
      likedByMe: false,
      savedByMe: false,
    });
  });

  it("sends only the posts the card's day previews use, not every post", async () => {
    // More posts on day 1, after the one that already has its place and image
    const extra = await Promise.all([
      createPost(older.id, '2026-09-12', 'older-day1-b'),
      createPost(older.id, '2026-09-12', 'older-day1-c'),
    ]);
    try {
      const page = await feed(viewer);
      const card = page.items.find((i) => i.trip.id === older.id)!;
      expect(card.posts.map((p) => p.caption)).toEqual([
        'older-day1',
        'older-day3',
      ]);
      // The card still shows the real total
      expect(card.trip.postCount).toBe(4);
    } finally {
      await prisma.post.deleteMany({
        where: { id: { in: extra.map((p) => p.id) } },
      });
    }
  });

  it("doesn't repeat or skip trips when one is published mid-scroll", async () => {
    const first = await feed(viewer, { limit: 1 });
    expect(titles(first)).toEqual(['newer']);
    expect(first.nextCursor).toEqual(expect.any(String));

    // The friend publishes a new trip between page 1 and page 2
    const fresh = await createTrip(friend, 'fresh', null);
    try {
      await createPost(fresh.id, '2026-09-12', 'fresh-post');
      await http()
        .post(`/api/trips/${fresh.id}/publish`)
        .set(as(friend))
        .expect(200);
      // Publishing stamps the current time. Pin it after the fixtures so the
      // test doesn't depend on the clock.
      await prisma.trip.update({
        where: { id: fresh.id },
        data: { publishedAt: new Date('2026-10-10T10:00:00Z') },
      });

      const second = await feed(viewer, {
        limit: 1,
        cursor: first.nextCursor!,
      });
      expect(titles(second)).toEqual(['older']);
      expect(second.nextCursor).toBeNull();

      // It shows up at the top on refresh
      expect(titles(await feed(viewer))).toEqual(['fresh', 'newer', 'older']);
    } finally {
      await prisma.trip.delete({ where: { id: fresh.id } });
    }
  });

  it('shows posts added after publishing on the card without moving the trip', async () => {
    const added = await createPost(older.id, '2026-09-15', 'older-late');
    try {
      const page = await feed(viewer);
      expect(titles(page)).toEqual(['newer', 'older']);
      const card = page.items.find((i) => i.trip.id === older.id)!;
      expect(card.posts.map((p) => p.caption)).toEqual([
        'older-day1',
        'older-day3',
        'older-late',
      ]);
    } finally {
      await prisma.post.delete({ where: { id: added.id } });
    }
  });

  it('stops showing a trip once the viewer unfollows its owner', async () => {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: viewer.id,
          followingId: friend.id,
        },
      },
    });
    try {
      await expect(feed(viewer)).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    } finally {
      await prisma.follow.create({
        data: { followerId: viewer.id, followingId: friend.id },
      });
    }
  });

  it('accepts type=friends and returns an empty page for type=local', async () => {
    expect(titles(await feed(viewer, { type: 'friends' }))).toEqual([
      'newer',
      'older',
    ]);
    await expect(feed(viewer, { type: 'local' })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('rejects an unknown feed type', async () => {
    await http()
      .get('/api/feed')
      .query({ type: 'fyp' })
      .set(as(viewer))
      .expect(400);
  });

  it("rejects a malformed cursor and another user's cursor", async () => {
    await http()
      .get('/api/feed')
      .query({ cursor: 'not-a-cursor' })
      .set(as(viewer))
      .expect(400);

    const first = await feed(viewer, { limit: 1 });
    await http()
      .get('/api/feed')
      .query({ cursor: first.nextCursor! })
      .set(as(loner))
      .expect(400);
  });
});
