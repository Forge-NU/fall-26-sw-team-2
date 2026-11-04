import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Location, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

// Account deletion calls Clerk first; stand in for it
jest.mock('../src/auth/clerk.client', () => ({
  clerkClient: { users: { deleteUser: jest.fn(() => Promise.resolve()) } },
}));

type PostBody = {
  id: string;
  rating: number | null;
  location: {
    id: string;
    rating: { average: number; count: number } | null;
  } | null;
  customLocationName: string | null;
};

// RATE-1: post ratings and the place ratings they add up to
describe('Place ratings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let other: User;
  let place: Location;
  let otherPlace: Location;
  let keyCount = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'rater');
    other = await createTestUser(prisma, 'otherrater');
    [place, otherPlace] = await Promise.all(
      ['Pastéis de Belém', 'Belém Tower'].map((name, i) =>
        prisma.location.create({
          data: {
            provider: 'mapbox',
            providerPlaceId: `test.rating.${owner.id}.${i}`,
            name,
            latitude: 38.697464,
            longitude: -9.203213,
          },
        }),
      ),
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await prisma.location.deleteMany({
      where: { id: { in: [place.id, otherPlace.id] } },
    });
    await app.close();
  });

  const as = (user: User) => ({ 'x-test-user': user.id });
  const server = () => request(app.getHttpServer());

  async function createTrip(user: User, published = false): Promise<Trip> {
    return prisma.trip.create({
      data: {
        ownerId: user.id,
        title: 'Lisbon',
        destination: 'Lisbon, Portugal',
        startDate: new Date('2026-09-12'),
        endDate: new Date('2026-09-16'),
        ...(published && { status: 'published', publishedAt: new Date() }),
      },
    });
  }

  function postBody(trip: Trip, user: User, extra: Record<string, unknown>) {
    return {
      tripId: trip.id,
      visitedOn: '2026-09-13',
      locationId: place.id,
      media: [
        {
          s3Key: `users/${user.id}/posts/r${++keyCount}.jpg`,
          mediaType: 'image',
        },
      ],
      ...extra,
    };
  }

  async function createPost(
    trip: Trip,
    extra: Record<string, unknown> = {},
    user: User = owner,
  ) {
    const res = await server()
      .post('/api/posts')
      .set(as(user))
      .send(postBody(trip, user, extra))
      .expect(201);
    return res.body as PostBody;
  }

  async function patchPost(id: string, body: Record<string, unknown>) {
    const res = await server()
      .patch(`/api/posts/${id}`)
      .set(as(owner))
      .send(body)
      .expect(200);
    return res.body as PostBody;
  }

  // The stored totals, which search filters on
  async function totals(location: Location = place) {
    return prisma.location.findUniqueOrThrow({
      where: { id: location.id },
      select: { ratingCount: true, ratingSum: true },
    });
  }

  // Each test starts with no rated posts at the test places
  afterEach(async () => {
    await prisma.trip.deleteMany({
      where: { ownerId: { in: [owner.id, other.id] } },
    });
    await prisma.location.updateMany({
      where: { id: { in: [place.id, otherPlace.id] } },
      data: { ratingCount: 0, ratingSum: 0 },
    });
  });

  describe('drafts', () => {
    it("doesn't count a rating until the trip is published", async () => {
      const trip = await createTrip(owner);
      const post = await createPost(trip, { rating: 4 });
      expect(post.rating).toBe(4);
      expect(post.location?.rating).toBeNull();
      await expect(totals()).resolves.toEqual({ ratingCount: 0, ratingSum: 0 });

      await server()
        .post(`/api/trips/${trip.id}/publish`)
        .set(as(owner))
        .expect(200);

      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 4 });
      const res = await server().get(`/api/posts/${post.id}`).set(as(other));
      expect((res.body as PostBody).location?.rating).toEqual({
        average: 4,
        count: 1,
      });
    });
  });

  describe('published trips', () => {
    it('averages the ratings of every published post at the place', async () => {
      const mine = await createTrip(owner, true);
      const theirs = await createTrip(other, true);
      const theirDraft = await createTrip(other);
      await createPost(mine, { rating: 5 });
      await createPost(mine, { rating: 4 });
      await createPost(mine); // unrated
      await createPost(theirDraft, { rating: 1 }, other); // draft, not counted
      const last = await createPost(theirs, { rating: 4 }, other);

      // The response already includes the post it just created
      expect(last.location?.rating).toEqual({ average: 4.3, count: 3 });
      await expect(totals()).resolves.toEqual({
        ratingCount: 3,
        ratingSum: 13,
      });
    });

    it('updates the place when the rating changes or is cleared', async () => {
      const trip = await createTrip(owner, true);
      await createPost(trip, { rating: 5 });
      const post = await createPost(trip, { rating: 3 });

      let updated = await patchPost(post.id, { rating: 1 });
      expect(updated.rating).toBe(1);
      expect(updated.location?.rating).toEqual({ average: 3, count: 2 });

      updated = await patchPost(post.id, { rating: null });
      expect(updated.rating).toBeNull();
      expect(updated.location?.rating).toEqual({ average: 5, count: 1 });

      // Edits that don't touch the rating or place leave it alone
      updated = await patchPost(post.id, { caption: 'Still good' });
      expect(updated.rating).toBeNull();
      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 5 });
    });

    it('moves the rating with the post to another place', async () => {
      const trip = await createTrip(owner, true);
      const post = await createPost(trip, { rating: 2 });

      const moved = await patchPost(post.id, { locationId: otherPlace.id });

      expect(moved.rating).toBe(2);
      expect(moved.location).toMatchObject({
        id: otherPlace.id,
        rating: { average: 2, count: 1 },
      });
      await expect(totals(place)).resolves.toEqual({
        ratingCount: 0,
        ratingSum: 0,
      });
      await expect(totals(otherPlace)).resolves.toEqual({
        ratingCount: 1,
        ratingSum: 2,
      });
    });

    it('clears the rating when the post switches to a custom location', async () => {
      const trip = await createTrip(owner, true);
      const post = await createPost(trip, { rating: 5 });

      const custom = await patchPost(post.id, {
        customLocationName: "Tia Rosa's kitchen",
      });

      expect(custom).toMatchObject({
        rating: null,
        location: null,
        customLocationName: "Tia Rosa's kitchen",
      });
      await expect(totals()).resolves.toEqual({ ratingCount: 0, ratingSum: 0 });
    });

    it('updates the place when the post is deleted', async () => {
      const trip = await createTrip(owner, true);
      await createPost(trip, { rating: 5 });
      const post = await createPost(trip, { rating: 2 });

      await server().delete(`/api/posts/${post.id}`).set(as(owner)).expect(204);

      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 5 });
    });

    it('updates the place when the trip is deleted', async () => {
      const kept = await createTrip(other, true);
      const deleted = await createTrip(owner, true);
      await createPost(kept, { rating: 3 }, other);
      await createPost(deleted, { rating: 5 });
      await createPost(deleted, { rating: 5, locationId: otherPlace.id });

      await server()
        .delete(`/api/trips/${deleted.id}`)
        .set(as(owner))
        .expect(204);

      await expect(totals(place)).resolves.toEqual({
        ratingCount: 1,
        ratingSum: 3,
      });
      await expect(totals(otherPlace)).resolves.toEqual({
        ratingCount: 0,
        ratingSum: 0,
      });
    });

    it('updates the place when the account is deleted', async () => {
      const leaving = await createTestUser(prisma, 'leaving');
      const trip = await createTrip(leaving, true);
      const kept = await createTrip(owner, true);
      await createPost(kept, { rating: 4 });
      await createPost(trip, { rating: 1 }, leaving);
      await expect(totals()).resolves.toEqual({ ratingCount: 2, ratingSum: 5 });

      await server().delete('/api/me').set(as(leaving)).expect(204);

      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 4 });
    });
  });

  describe('validation', () => {
    it('rejects a rating outside 1-5, or not a whole number', async () => {
      const trip = await createTrip(owner);
      const post = await createPost(trip);

      for (const rating of [0, 6, -1, 4.5, '5', true]) {
        await server()
          .post('/api/posts')
          .set(as(owner))
          .send(postBody(trip, owner, { rating }))
          .expect(400);
        await server()
          .patch(`/api/posts/${post.id}`)
          .set(as(owner))
          .send({ rating })
          .expect(400);
      }
    });

    it('rejects a rating on a post with a custom location', async () => {
      const trip = await createTrip(owner, true);

      const res = await server()
        .post('/api/posts')
        .set(as(owner))
        .send(
          postBody(trip, owner, {
            locationId: undefined,
            customLocationName: 'Back home',
            rating: 4,
          }),
        )
        .expect(400);
      expect((res.body as { message: string }).message).toMatch(
        /Only posts at a Mapbox place can be rated/,
      );

      // Already custom
      const custom = await createPost(trip, {
        locationId: undefined,
        customLocationName: 'Back home',
      });
      await server()
        .patch(`/api/posts/${custom.id}`)
        .set(as(owner))
        .send({ rating: 4 })
        .expect(400);

      // Switching to custom in the same request
      const rated = await createPost(trip, { rating: 4 });
      await server()
        .patch(`/api/posts/${rated.id}`)
        .set(as(owner))
        .send({ customLocationName: 'Back home', rating: 4 })
        .expect(400);

      // Nothing changed
      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 4 });
    });
  });

  describe('permissions', () => {
    it('only lets the trip owner set the rating', async () => {
      const published = await createTrip(owner, true);
      const draft = await createTrip(owner);
      const post = await createPost(published, { rating: 4 });
      const draftPost = await createPost(draft, { rating: 4 });

      await server()
        .patch(`/api/posts/${post.id}`)
        .set(as(other))
        .send({ rating: 1 })
        .expect(403);
      await server()
        .patch(`/api/posts/${post.id}`)
        .set(as(other))
        .send({ rating: null })
        .expect(403);
      // A draft is hidden from them, so it's a 404
      await server()
        .patch(`/api/posts/${draftPost.id}`)
        .set(as(other))
        .send({ rating: 1 })
        .expect(404);
      // Nor can they add a rated post to the owner's trip
      await server()
        .post('/api/posts')
        .set(as(other))
        .send(postBody(published, other, { rating: 1 }))
        .expect(403);

      await expect(totals()).resolves.toEqual({ ratingCount: 1, ratingSum: 4 });
    });
  });

  describe('database constraints', () => {
    it('rejects a rating outside 1-5 or without a Mapbox place', async () => {
      const trip = await createTrip(owner);
      const row = (data: Record<string, unknown>) =>
        prisma.post.create({
          data: { tripId: trip.id, visitedOn: new Date('2026-09-13'), ...data },
        });

      await expect(row({ locationId: place.id, rating: 6 })).rejects.toThrow(
        /posts_rating_check/,
      );
      await expect(
        row({ customLocationName: 'Back home', rating: 3 }),
      ).rejects.toThrow(/posts_rating_location_check/);
    });
  });
});
