import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { Location, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoriesCleanupService } from '../src/stories/stories-cleanup.service';
import {
  DELETE_USER_TX_OPTIONS,
  deleteUserRows,
} from '../src/users/delete-user-rows';
import type {
  LocationResponse,
  PostResponse,
  ResolveLocationResponse,
  SearchPage,
  StoryResponse,
} from 'shared-types';
import { createTestApp, createTestUser, isoDate } from './utils/test-app';

jest.setTimeout(60_000);

const HOUR_MS = 60 * 60 * 1000;

// #94 LOC-2: dropped pins. Resolve creates the row, only its user can attach
// it, and only to one post or story, and every way that post or story goes
// away (or moves off the pin) deletes it.
describe('Custom pins (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let other: User;
  let published: Trip;
  let mapboxPlace: Location;
  // A word no other test data uses, so search only finds these rows
  const token = `pintest${randomUUID().slice(0, 8)}`;
  // Somewhere in the South Pacific, far from the seeded and test places
  const spot = { latitude: -47.123456, longitude: -139.654321 };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'pinner');
    other = await createTestUser(prisma, 'other_pinner');
    published = await createTrip(owner, 'published');
    mapboxPlace = await prisma.location.create({
      data: {
        provider: 'mapbox',
        providerPlaceId: `test.pins.${owner.id}`,
        name: `${token} harbour`,
        ...spot,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await prisma.location.deleteMany({
      where: { OR: [{ id: mapboxPlace.id }, { name: { contains: token } }] },
    });
    await app.close();
  });

  const as = (user: User) => ({ 'x-test-user': user.id });
  const server = () => app.getHttpServer();

  function createTrip(user: User, status: 'draft' | 'published') {
    return prisma.trip.create({
      data: {
        ownerId: user.id,
        title: `${token} trip`,
        destination: 'Nowhere',
        startDate: new Date(`${isoDate(-2)}T00:00:00Z`),
        endDate: new Date(`${isoDate(2)}T00:00:00Z`),
        status,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });
  }

  async function dropPin(
    user: User,
    name = `${token} secret beach`,
    point = spot,
  ): Promise<LocationResponse> {
    const res = await request(server())
      .post('/api/locations/resolve')
      .set(as(user))
      .send({ kind: 'pin', name, ...point })
      .expect(200);
    const body = res.body as ResolveLocationResponse;
    if (body.kind !== 'pin') throw new Error('expected a pin');
    return body.location;
  }

  const postBody = (
    user: User,
    trip: Trip,
    fields: Record<string, unknown>,
  ) => ({
    tripId: trip.id,
    visitedOn: isoDate(),
    media: [
      {
        s3Key: `users/${user.id}/posts/${randomUUID()}.jpg`,
        mediaType: 'image',
      },
    ],
    ...fields,
  });

  async function createPost(
    user: User,
    trip: Trip,
    fields: Record<string, unknown>,
  ): Promise<PostResponse> {
    const res = await request(server())
      .post('/api/posts')
      .set(as(user))
      .send(postBody(user, trip, fields))
      .expect(201);
    return res.body as PostResponse;
  }

  async function createStory(
    user: User,
    fields: Record<string, unknown>,
  ): Promise<StoryResponse> {
    const res = await request(server())
      .post('/api/stories')
      .set(as(user))
      .send({
        s3Key: `users/${user.id}/stories/${randomUUID()}.jpg`,
        date: isoDate(),
        ...fields,
      })
      .expect(201);
    return res.body as StoryResponse;
  }

  const exists = async (id: string) =>
    (await prisma.location.findUnique({ where: { id } })) !== null;

  describe('POST /api/locations/resolve with a pin', () => {
    it('creates a custom row owned by the user', async () => {
      const pin = await dropPin(owner);

      expect(pin).toMatchObject({
        provider: 'custom',
        name: `${token} secret beach`,
        ...spot,
        address: null,
        city: null,
        countryCode: null,
        rating: null,
      });
      expect(pin).not.toHaveProperty('createdBy');
      const row = await prisma.location.findUniqueOrThrow({
        where: { id: pin.id },
      });
      expect(row.createdBy).toBe(owner.id);
      expect(row.providerPlaceId).toBe(pin.providerPlaceId);
    });

    it('makes two rows for two identical pins', async () => {
      const first = await dropPin(owner, `${token} same spot`);
      const second = await dropPin(owner, `${token} same spot`);

      expect(second.id).not.toBe(first.id);
      expect(second.providerPlaceId).not.toBe(first.providerPlaceId);
    });

    it('still resolves a name-only custom location without a row', async () => {
      await request(server())
        .post('/api/locations/resolve')
        .set(as(owner))
        .send({ kind: 'custom', name: `${token} name only` })
        .expect(200, { kind: 'custom', name: `${token} name only` });
      await expect(
        prisma.location.count({ where: { name: `${token} name only` } }),
      ).resolves.toBe(0);
    });

    it.each([
      [{ name: 'a'.repeat(101) }],
      [{ latitude: undefined }],
      [{ latitude: 91 }],
      [{ mapboxId: 'dXJuOm1ieHBvaTo' }],
      [{ city: 'Lisbon' }],
    ])('rejects an invalid pin (%p)', async (change) => {
      await request(server())
        .post('/api/locations/resolve')
        .set(as(owner))
        .send({ kind: 'pin', name: `${token} bad`, ...spot, ...change })
        .expect(400);
    });
  });

  describe('attaching a pin', () => {
    it('puts the pin on a post as its location', async () => {
      const pin = await dropPin(owner);
      const post = await createPost(owner, published, { locationId: pin.id });

      expect(post.location).toMatchObject({ id: pin.id, provider: 'custom' });
      expect(post.customLocationName).toBeNull();
    });

    it("rejects someone else's pin", async () => {
      const pin = await dropPin(other);
      const res = await request(server())
        .post('/api/posts')
        .set(as(owner))
        .send(postBody(owner, published, { locationId: pin.id }))
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('dropped a pin');
    });

    it('rejects a pin that another post already uses', async () => {
      const pin = await dropPin(owner);
      await createPost(owner, published, { locationId: pin.id });

      const res = await request(server())
        .post('/api/posts')
        .set(as(owner))
        .send(postBody(owner, published, { locationId: pin.id }))
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('already on another post');
    });

    it('rejects a pin a story uses, on a post or another story', async () => {
      const pin = await dropPin(owner);
      await createStory(owner, { locationId: pin.id });

      await request(server())
        .post('/api/posts')
        .set(as(owner))
        .send(postBody(owner, published, { locationId: pin.id }))
        .expect(400);
      await request(server())
        .post('/api/stories')
        .set(as(owner))
        .send({
          s3Key: `users/${owner.id}/stories/${randomUUID()}.jpg`,
          date: isoDate(),
          locationId: pin.id,
        })
        .expect(400);
    });

    it("rejects moving a post onto another post's pin", async () => {
      const pin = await dropPin(owner);
      await createPost(owner, published, { locationId: pin.id });
      const second = await createPost(owner, published, {
        customLocationName: `${token} somewhere`,
      });

      await request(server())
        .patch(`/api/posts/${second.id}`)
        .set(as(owner))
        .send({ locationId: pin.id })
        .expect(400);
    });

    it('lets a post keep its own pin through an edit', async () => {
      const pin = await dropPin(owner);
      const post = await createPost(owner, published, { locationId: pin.id });

      const res = await request(server())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ locationId: pin.id, caption: 'still here' })
        .expect(200);
      expect((res.body as PostResponse).location?.id).toBe(pin.id);
      await expect(exists(pin.id)).resolves.toBe(true);
    });

    it('only lets one of two concurrent posts take the same pin', async () => {
      const pin = await dropPin(owner);

      const results = await Promise.all(
        [0, 1].map(() =>
          request(server())
            .post('/api/posts')
            .set(as(owner))
            .send(postBody(owner, published, { locationId: pin.id })),
        ),
      );

      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      await expect(
        prisma.post.count({ where: { locationId: pin.id } }),
      ).resolves.toBe(1);
    });
  });

  describe('deleting the pin with its post or story', () => {
    it('deletes the pin when its post is deleted', async () => {
      const pin = await dropPin(owner);
      const post = await createPost(owner, published, { locationId: pin.id });

      await request(server())
        .delete(`/api/posts/${post.id}`)
        .set(as(owner))
        .expect(204);

      await expect(exists(pin.id)).resolves.toBe(false);
    });

    it('never deletes a Mapbox place with its post', async () => {
      const post = await createPost(owner, published, {
        locationId: mapboxPlace.id,
      });

      await request(server())
        .delete(`/api/posts/${post.id}`)
        .set(as(owner))
        .expect(204);

      await expect(exists(mapboxPlace.id)).resolves.toBe(true);
    });

    it.each([
      ['a Mapbox place', () => ({ locationId: mapboxPlace.id })],
      ['a custom name', () => ({ customLocationName: `${token} renamed` })],
    ])('deletes the pin when the post moves to %s', async (_label, change) => {
      const pin = await dropPin(owner);
      const post = await createPost(owner, published, {
        locationId: pin.id,
      });

      await request(server())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send(change())
        .expect(200);

      await expect(exists(pin.id)).resolves.toBe(false);
    });

    it('deletes the old pin when the post moves to a new pin', async () => {
      const oldPin = await dropPin(owner);
      const newPin = await dropPin(owner);
      const post = await createPost(owner, published, {
        locationId: oldPin.id,
      });

      await request(server())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ locationId: newPin.id })
        .expect(200);

      await expect(exists(oldPin.id)).resolves.toBe(false);
      await expect(exists(newPin.id)).resolves.toBe(true);
    });

    it('deletes the pin when its story is deleted', async () => {
      const pin = await dropPin(owner);
      const story = await createStory(owner, { locationId: pin.id });

      await request(server())
        .delete(`/api/stories/${story.id}`)
        .set(as(owner))
        .expect(204);

      await expect(exists(pin.id)).resolves.toBe(false);
    });

    it('deletes the pin when the cleanup job removes its expired story', async () => {
      const pin = await dropPin(owner);
      const story = await createStory(owner, { locationId: pin.id });
      await prisma.story.update({
        where: { id: story.id },
        data: { expiresAt: new Date(Date.now() - HOUR_MS) },
      });

      await app.get(StoriesCleanupService).deleteExpired();

      await expect(exists(pin.id)).resolves.toBe(false);
    });

    it('deletes the pins on its posts and stories when a trip is deleted', async () => {
      const trip = await createTrip(owner, 'draft');
      const postPin = await dropPin(owner);
      const storyPin = await dropPin(owner);
      await createPost(owner, trip, { locationId: postPin.id });
      await createStory(owner, {
        tripId: trip.id,
        keepOnTrip: true,
        locationId: storyPin.id,
      });

      await request(server())
        .delete(`/api/trips/${trip.id}`)
        .set(as(owner))
        .expect(204);

      await expect(exists(postPin.id)).resolves.toBe(false);
      await expect(exists(storyPin.id)).resolves.toBe(false);
    });

    it('deletes every pin a user dropped when the user is deleted', async () => {
      const leaving = await createTestUser(prisma, 'leaving');
      const trip = await createTrip(leaving, 'published');
      const onPost = await dropPin(leaving);
      const onStory = await dropPin(leaving);
      const unused = await dropPin(leaving);
      await createPost(leaving, trip, { locationId: onPost.id, rating: 4 });
      await createStory(leaving, { locationId: onStory.id });

      await prisma.$transaction(
        (tx) => deleteUserRows(tx, leaving.id),
        DELETE_USER_TX_OPTIONS,
      );

      for (const pin of [onPost, onStory, unused]) {
        await expect(exists(pin.id)).resolves.toBe(false);
      }
    });
  });

  describe('pins nobody attached', () => {
    async function agedPin(hours: number) {
      const pin = await dropPin(owner);
      await prisma.location.update({
        where: { id: pin.id },
        data: { createdAt: new Date(Date.now() - hours * HOUR_MS) },
      });
      return pin;
    }

    it('are deleted by the cleanup job after 24 hours', async () => {
      const old = await agedPin(25);
      const fresh = await agedPin(1);
      const oldButUsed = await agedPin(25);
      await createPost(owner, published, { locationId: oldButUsed.id });

      const deleted = await app.get(StoriesCleanupService).deleteUnusedPins();

      expect(deleted).toBeGreaterThanOrEqual(1);
      await expect(exists(old.id)).resolves.toBe(false);
      await expect(exists(fresh.id)).resolves.toBe(true);
      await expect(exists(oldButUsed.id)).resolves.toBe(true);
      await expect(exists(mapboxPlace.id)).resolves.toBe(true);
    });

    it("can't be attached once the cleanup job deleted them", async () => {
      const old = await agedPin(25);
      await app.get(StoriesCleanupService).deleteUnusedPins();

      const res = await request(server())
        .post('/api/posts')
        .set(as(owner))
        .send(postBody(owner, published, { locationId: old.id }))
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('Location not found');
    });
  });

  describe('ratings', () => {
    it("rates a pin with its post's rating", async () => {
      const pin = await dropPin(owner);
      const post = await createPost(owner, published, {
        locationId: pin.id,
        rating: 4,
      });

      expect(post.rating).toBe(4);
      expect(post.location?.rating).toEqual({ average: 4, count: 1 });

      const res = await request(server())
        .patch(`/api/posts/${post.id}`)
        .set(as(owner))
        .send({ rating: 2 })
        .expect(200);
      expect((res.body as PostResponse).location?.rating).toEqual({
        average: 2,
        count: 1,
      });
    });

    it('still rejects a rating on a custom name', async () => {
      await request(server())
        .post('/api/posts')
        .set(as(owner))
        .send(
          postBody(owner, published, {
            customLocationName: `${token} no rating`,
            rating: 4,
          }),
        )
        .expect(400);
    });
  });

  describe('search', () => {
    let pinPost: PostResponse;
    let pinTrip: Trip;
    let namePost: PostResponse;
    let nameTrip: Trip;

    beforeAll(async () => {
      pinTrip = await createTrip(owner, 'published');
      nameTrip = await createTrip(owner, 'published');
      const pin = await dropPin(owner, `${token} lagoon`);
      pinPost = await createPost(owner, pinTrip, {
        locationId: pin.id,
        caption: `${token} swim`,
      });
      namePost = await createPost(owner, nameTrip, {
        customLocationName: `${token} lagoon`,
        caption: `${token} swim`,
      });
    });

    const search = async (params: Record<string, string | number>) => {
      const res = await request(server())
        .get('/api/search')
        .set(as(other))
        .query({ q: token, ...params })
        .expect(200);
      return (res.body as SearchPage).items.map(
        (item) => (item as { id: string }).id,
      );
    };
    const near = {
      lat: spot.latitude,
      lng: spot.longitude,
      radiusKm: 5,
    };

    it('finds a post with a pin by radius, but not one with only a name', async () => {
      const ids = await search({ type: 'posts', ...near });

      expect(ids).toContain(pinPost.id);
      expect(ids).not.toContain(namePost.id);
    });

    it('finds a trip by the radius of its pinned post', async () => {
      const ids = await search({ type: 'trips', ...near });

      expect(ids).toContain(pinTrip.id);
      expect(ids).not.toContain(nameTrip.id);
    });

    it('leaves pins out of place search', async () => {
      const ids = await search({ type: 'places' });

      expect(ids).not.toContain(pinPost.location?.id);
      // The Mapbox place with the same word shows up once a published post uses it
      await createPost(owner, pinTrip, { locationId: mapboxPlace.id });
      expect(await search({ type: 'places' })).toContain(mapboxPlace.id);
    });
  });
});
