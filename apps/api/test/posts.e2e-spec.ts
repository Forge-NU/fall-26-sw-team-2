import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Location, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser, storageMock } from './utils/test-app';

type PostBody = {
  id: string;
  media: { url: string }[];
  location: { id: string; latitude: number } | null;
  customLocationName: string | null;
};

describe('Posts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let other: User;
  let trip: Trip;
  let location: Location;
  let keyCount = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'poster');
    other = await createTestUser(prisma, 'intruder');
    trip = await prisma.trip.create({
      data: {
        ownerId: owner.id,
        title: 'Lisbon',
        destination: 'Lisbon, Portugal',
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-16'),
      },
    });
    location = await prisma.location.create({
      data: {
        provider: 'mapbox',
        providerPlaceId: `test.${owner.id}`,
        name: 'Pastéis de Belém',
        latitude: 38.697464,
        longitude: -9.203213,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await prisma.location.delete({ where: { id: location.id } });
    await app.close();
  });

  const as = (user: User) => ({ 'x-test-user': user.id });
  const newKey = (user: User = owner) =>
    `users/${user.id}/posts/${++keyCount}.jpg`;
  const mediaItem = (s3Key = newKey()) => ({ s3Key, mediaType: 'image' });

  function postBody(overrides: Record<string, unknown> = {}) {
    return {
      tripId: trip.id,
      visitedOn: '2026-09-13',
      caption: 'Six pastéis between the two of us.',
      locationId: location.id,
      media: [mediaItem(), mediaItem()],
      ...overrides,
    };
  }

  async function createPost(overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/posts')
      .set(as(owner))
      .send(postBody(overrides))
      .expect(201);
    return res.body as PostBody;
  }

  describe('POST /api/posts', () => {
    it('creates a post with media, location and author', async () => {
      const post = await createPost();
      expect(post).toMatchObject({
        tripId: trip.id,
        visitedOn: '2026-09-13',
        caption: 'Six pastéis between the two of us.',
        author: { id: owner.id, username: owner.username },
        location: {
          id: location.id,
          name: 'Pastéis de Belém',
          latitude: 38.697464,
          longitude: -9.203213,
        },
        customLocationName: null,
      });
      expect(post.media).toHaveLength(2);
      expect(post.media[0].url).toMatch(/^https:\/\/s3\.test\/users\//);
    });

    it('creates a post with a custom location', async () => {
      const post = await createPost({
        locationId: undefined,
        customLocationName: "  Tia Rosa's kitchen  ",
      });
      expect(post.location).toBeNull();
      expect(post.customLocationName).toBe("Tia Rosa's kitchen");
    });

    it('returns 403 when someone else adds a post to your published trip', async () => {
      const published = await prisma.trip.create({
        data: {
          ownerId: owner.id,
          title: 'Published',
          destination: 'Somewhere',
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-16'),
          status: 'published',
          publishedAt: new Date(),
        },
      });
      await request(app.getHttpServer())
        .post('/api/posts')
        .set(as(other))
        .send(
          postBody({ tripId: published.id, media: [mediaItem(newKey(other))] }),
        )
        .expect(403);
    });

    it('returns 404 when someone else adds a post to your draft', async () => {
      await request(app.getHttpServer())
        .post('/api/posts')
        .set(as(other))
        .send(postBody({ media: [mediaItem(newKey(other))] }))
        .expect(404);
    });

    it("rejects someone else's media key, a reused key and a malformed key", async () => {
      const used = newKey();
      await createPost({ media: [mediaItem(used)] });

      for (const s3Key of [newKey(other), used, 'not-a-key.jpg']) {
        await request(app.getHttpServer())
          .post('/api/posts')
          .set(as(owner))
          .send(postBody({ media: [mediaItem(s3Key)] }))
          .expect(400);
      }
    });

    it('rejects a date outside the trip, bad locations and bad media lists', async () => {
      const bad = [
        { visitedOn: '2026-09-17' },
        { locationId: undefined },
        { customLocationName: 'Both set' },
        { locationId: '00000000-0000-4000-8000-000000000000' },
        { media: [] },
        { media: Array.from({ length: 31 }, () => mediaItem()) },
        { media: [{ s3Key: newKey(), mediaType: 'gif' }] },
        { caption: 'x'.repeat(2201) },
        { caption: '❤️'.repeat(1101) },
        { media: [{ ...mediaItem(), width: 3000000000 }] },
        { media: [{ ...mediaItem(), durationMs: 5000 }] },
        { media: [{ s3Key: newKey(), mediaType: 'video' }] },
        { tripId: 'not-a-uuid' },
        { authorId: other.id },
      ];
      for (const overrides of bad) {
        await request(app.getHttpServer())
          .post('/api/posts')
          .set(as(owner))
          .send(postBody(overrides))
          .expect(400);
      }
    });

    it('accepts a video with a duration', async () => {
      const post = await createPost({
        media: [{ s3Key: newKey(), mediaType: 'video', durationMs: 12000 }],
      });
      expect(post.media).toMatchObject([
        { mediaType: 'video', durationMs: 12000 },
      ]);
    });

    it('accepts 30 media items', async () => {
      const post = await createPost({
        media: Array.from({ length: 30 }, () => mediaItem()),
      });
      expect(post.media).toHaveLength(30);
    });
  });

  describe('GET /api/posts/:id', () => {
    it('hides posts in a draft from everyone but the owner', async () => {
      const post = await createPost();
      await request(app.getHttpServer())
        .get(`/api/posts/${post.id}`)
        .set(as(owner))
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/posts/${post.id}`)
        .set(as(other))
        .expect(404);
    });
  });

  describe('PATCH /api/posts/:id', () => {
    it('replaces media, keeping existing keys and deleting removed ones', async () => {
      const [keep, drop, add] = [newKey(), newKey(), newKey()];
      const post = await createPost({
        media: [mediaItem(keep), mediaItem(drop)],
      });
      storageMock.deleteObjects.mockClear();

      const res = await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ media: [mediaItem(add), mediaItem(keep)] })
        .expect(200);

      expect((res.body as PostBody).media.map((m) => m.url)).toEqual([
        `https://s3.test/${add}`,
        `https://s3.test/${keep}`,
      ]);
      expect(storageMock.deleteObjects).toHaveBeenCalledWith([drop]);
      expect(await prisma.postMedia.count({ where: { s3Key: drop } })).toBe(0);
      expect((res.body as { updatedAt: string }).updatedAt).not.toBe(
        (post as unknown as { updatedAt: string }).updatedAt,
      );
    });

    it('switches between a Mapbox place and a custom location', async () => {
      const post = await createPost();

      const custom = await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ customLocationName: 'Back alley bakery' })
        .expect(200);
      expect(custom.body).toMatchObject({
        location: null,
        customLocationName: 'Back alley bakery',
      });

      const place = await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ locationId: location.id })
        .expect(200);
      expect(place.body).toMatchObject({
        location: { id: location.id },
        customLocationName: null,
      });
    });

    it('clears the caption and rejects a date outside the trip', async () => {
      const post = await createPost();
      const res = await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ caption: null })
        .expect(200);
      expect((res.body as { caption: null }).caption).toBeNull();

      await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ visitedOn: '2026-09-20' })
        .expect(400);
    });

    it('handles two media edits to the same post at once', async () => {
      const [a, b, c] = [newKey(), newKey(), newKey()];
      const post = await createPost({ media: [mediaItem(a), mediaItem(b)] });
      storageMock.deleteObjects.mockClear();

      const results = await Promise.all([
        request(app.getHttpServer())
          .patch(`/api/posts/${post.id}`)
          .set(as(owner))
          .send({ media: [mediaItem(a)] }),
        request(app.getHttpServer())
          .patch(`/api/posts/${post.id}`)
          .set(as(owner))
          .send({ media: [mediaItem(b), mediaItem(c)] }),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);

      // They run one at a time, so the post ends up with exactly one of the
      // two lists, in order, never a mix of both
      const remaining = (
        await prisma.postMedia.findMany({
          where: { postId: post.id },
          orderBy: { position: 'asc' },
        })
      ).map((m) => m.s3Key);
      expect([[a], [b, c]]).toContainEqual(remaining);
    });

    it("can't move a post to another trip", async () => {
      const post = await createPost();
      await request(app.getHttpServer())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ tripId: trip.id })
        .expect(400);
    });
  });

  describe('DELETE /api/posts/:id', () => {
    it('deletes the post, its media rows and its S3 objects', async () => {
      const key = newKey();
      const post = await createPost({ media: [mediaItem(key)] });
      storageMock.deleteObjects.mockClear();

      await request(app.getHttpServer())
        .delete(`/api/posts/${post.id}`)
        .set(as(owner))
        .expect(204);

      expect(
        await prisma.post.findUnique({ where: { id: post.id } }),
      ).toBeNull();
      expect(await prisma.postMedia.count({ where: { s3Key: key } })).toBe(0);
      expect(storageMock.deleteObjects).toHaveBeenCalledWith([key]);
    });
  });

  describe('GET /api/trips/:id/posts', () => {
    it('lists posts by date, then the order they were added, and paginates', async () => {
      const listTrip = await prisma.trip.create({
        data: {
          ownerId: owner.id,
          title: 'Ordering',
          destination: 'Somewhere',
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-16'),
        },
      });
      const add = (visitedOn: string, caption: string) =>
        createPost({ tripId: listTrip.id, visitedOn, caption });
      await add('2026-09-14', 'third');
      await add('2026-09-12', 'first');
      await add('2026-09-14', 'fourth');
      await add('2026-09-13', 'second');

      const all = await request(app.getHttpServer())
        .get(`/api/trips/${listTrip.id}/posts`)
        .set(as(owner))
        .expect(200);
      expect(
        (all.body as { items: { caption: string }[] }).items.map(
          (p) => p.caption,
        ),
      ).toEqual(['first', 'second', 'third', 'fourth']);

      const page1 = await request(app.getHttpServer())
        .get(`/api/trips/${listTrip.id}/posts?limit=3`)
        .set(as(owner))
        .expect(200);
      const body1 = page1.body as { nextCursor: string };
      const page2 = await request(app.getHttpServer())
        .get(
          `/api/trips/${listTrip.id}/posts?limit=3&cursor=${body1.nextCursor}`,
        )
        .set(as(owner))
        .expect(200);
      expect(page2.body).toMatchObject({
        items: [{ caption: 'fourth' }],
        nextCursor: null,
      });

      await request(app.getHttpServer())
        .get(`/api/trips/${listTrip.id}/posts`)
        .set(as(other))
        .expect(404);

      // A cursor from another trip's posts isn't valid here
      await createPost();
      await createPost();
      const elsewhere = await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}/posts?limit=1`)
        .set(as(owner))
        .expect(200);
      const { nextCursor } = elsewhere.body as { nextCursor: string };
      expect(nextCursor).toEqual(expect.any(String));
      await request(app.getHttpServer())
        .get(`/api/trips/${listTrip.id}/posts`)
        .query({ cursor: nextCursor })
        .set(as(owner))
        .expect(400);
    });
  });

  describe('GET /api/users/:userId/posts', () => {
    let profile: User;
    let published: Trip;
    let draft: Trip;

    type ListBody = {
      items: {
        id: string;
        caption: string;
        tripId: string;
        author: { id: string };
        media: { url: string }[];
      }[];
      nextCursor: string | null;
    };

    beforeAll(async () => {
      profile = await createTestUser(prisma, 'profileposts');
      const makeTrip = (status: 'draft' | 'published', start: string) =>
        prisma.trip.create({
          data: {
            ownerId: profile.id,
            title: status,
            destination: 'Somewhere',
            startDate: new Date(start),
            endDate: new Date(new Date(start).getTime() + 4 * 86_400_000),
            status,
            publishedAt: status === 'published' ? new Date() : null,
          },
        });
      published = await makeTrip('published', '2026-09-01');
      draft = await makeTrip('draft', '2026-10-01');

      const makePost = (
        t: Trip,
        caption: string,
        visitedOn: string,
        createdAt: string,
      ) =>
        prisma.post.create({
          data: {
            tripId: t.id,
            caption,
            customLocationName: 'Somewhere',
            visitedOn: new Date(visitedOn),
            createdAt: new Date(createdAt),
            media: {
              create: [
                {
                  s3Key: `users/${profile.id}/posts/${caption}.jpg`,
                  mediaType: 'image',
                  position: 0,
                },
              ],
            },
          },
        });
      await makePost(published, 'oldest', '2026-09-01', '2026-09-01T10:00Z');
      // Same day: the one added later comes first
      await makePost(
        published,
        'day3-first',
        '2026-09-03',
        '2026-09-03T10:00Z',
      );
      await makePost(
        published,
        'day3-second',
        '2026-09-03',
        '2026-09-03T11:00Z',
      );
      await makePost(draft, 'draft', '2026-10-02', '2026-10-02T10:00Z');
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: profile.id } });
    });

    async function list(viewer: User, query = '') {
      const res = await request(app.getHttpServer())
        .get(`/api/users/${profile.id}/posts${query}`)
        .set(as(viewer))
        .expect(200);
      return res.body as ListBody;
    }

    const captions = (body: ListBody) => body.items.map((p) => p.caption);

    it("hides posts in someone else's drafts, newest first", async () => {
      const body = await list(other);
      expect(captions(body)).toEqual(['day3-second', 'day3-first', 'oldest']);
      expect(body.nextCursor).toBeNull();
    });

    it('includes posts in your own drafts', async () => {
      const body = await list(profile);
      expect(captions(body)).toEqual([
        'draft',
        'day3-second',
        'day3-first',
        'oldest',
      ]);
      const [first] = body.items;
      expect(first.tripId).toBe(draft.id);
      expect(first.author.id).toBe(profile.id);
      expect(first.media[0].url).toMatch(/^https:\/\/s3\.test\//);
    });

    it('pages through every post once, in order', async () => {
      const all = await list(profile);
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page = await list(
          profile,
          `?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
        );
        expect(page.items).toHaveLength(1);
        seen.push(...page.items.map((p) => p.id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toEqual(all.items.map((p) => p.id));
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("never shows someone else's drafts, even from the owner's cursor", async () => {
      // The owner's first page is the draft's post, so its cursor points there
      const ownFirst = await list(profile, '?limit=1');
      expect(captions(ownFirst)).toEqual(['draft']);

      const body = await list(other, `?cursor=${ownFirst.nextCursor}`);
      expect(captions(body)).toEqual(['day3-second', 'day3-first', 'oldest']);
    });

    it('rejects a cursor from another list or one that is malformed', async () => {
      // A cursor from the trip page's post list
      const tripPage = await request(app.getHttpServer())
        .get(`/api/trips/${published.id}/posts?limit=1`)
        .set(as(profile))
        .expect(200);
      const tripCursor = (tripPage.body as ListBody).nextCursor;
      expect(tripCursor).not.toBeNull();
      await request(app.getHttpServer())
        .get(`/api/users/${profile.id}/posts?cursor=${tripCursor}`)
        .set(as(profile))
        .expect(400);

      // A bare post ID isn't a cursor
      const own = await list(profile);
      await request(app.getHttpServer())
        .get(`/api/users/${profile.id}/posts?cursor=${own.items[0].id}`)
        .set(as(profile))
        .expect(400);
    });

    it('leaves out deleted posts', async () => {
      const before = await list(other);
      const oldest = before.items.find((p) => p.caption === 'oldest')!;
      await request(app.getHttpServer())
        .delete(`/api/posts/${oldest.id}`)
        .set(as(profile))
        .expect(204);

      const after = await list(other);
      expect(captions(after)).toEqual(['day3-second', 'day3-first']);
    });

    it('returns 404 for a user that does not exist and 400 for a limit over 50', async () => {
      await request(app.getHttpServer())
        .get('/api/users/user_does_not_exist/posts')
        .set(as(owner))
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/users/${profile.id}/posts?limit=51`)
        .set(as(owner))
        .expect(400);
    });
  });
});
