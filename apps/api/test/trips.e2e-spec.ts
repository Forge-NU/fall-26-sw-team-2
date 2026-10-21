import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  createTestUser,
  isoDate,
  storageMock,
} from './utils/test-app';

type TripBody = { id: string; status: string; postCount: number };

describe('Trips (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let other: User;

  const lisbon = {
    title: '5 Days in Lisbon',
    destination: 'Lisbon, Portugal',
    startDate: '2026-09-12',
    endDate: '2026-09-16',
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'owner');
    other = await createTestUser(prisma, 'other');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await app.close();
  });

  const as = (user: User) => ({ 'x-test-user': user.id });

  async function createTrip(body: Record<string, unknown> = lisbon) {
    const res = await request(app.getHttpServer())
      .post('/api/trips')
      .set(as(owner))
      .send(body)
      .expect(201);
    return res.body as TripBody;
  }

  async function addPost(tripId: string, visitedOn = '2026-09-12') {
    return prisma.post.create({
      data: {
        tripId,
        visitedOn: new Date(visitedOn),
        customLocationName: 'Somewhere',
        media: {
          create: [
            {
              s3Key: `users/${owner.id}/posts/${tripId}-${visitedOn}.jpg`,
              mediaType: 'image',
              position: 0,
            },
          ],
        },
      },
    });
  }

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .post('/api/trips')
      .send(lisbon)
      .expect(401);
  });

  describe('POST /api/trips', () => {
    it('creates a draft', async () => {
      const trip = await createTrip();
      expect(trip).toMatchObject({
        title: '5 Days in Lisbon',
        destination: 'Lisbon, Portugal',
        description: null,
        startDate: '2026-09-12',
        endDate: '2026-09-16',
        status: 'draft',
        publishedAt: null,
        postCount: 0,
        coverImageUrl: null,
        owner: { id: owner.id, username: owner.username },
      });
    });

    it('rejects an end date before the start date', async () => {
      await request(app.getHttpServer())
        .post('/api/trips')
        .set(as(owner))
        .send({ ...lisbon, endDate: '2026-09-11' })
        .expect(400);
    });

    it('rejects missing fields, bad dates, blank titles and unknown fields', async () => {
      const bad = [
        { ...lisbon, destination: undefined },
        { ...lisbon, startDate: '2026-02-30' },
        { ...lisbon, startDate: '09/12/2026' },
        { ...lisbon, title: '   ' },
        { ...lisbon, title: 'x'.repeat(101) },
        // 60 hearts is 120 characters to Postgres
        { ...lisbon, title: '❤️'.repeat(60) },
        { ...lisbon, status: 'published' },
      ];
      for (const body of bad) {
        await request(app.getHttpServer())
          .post('/api/trips')
          .set(as(owner))
          .send(body)
          .expect(400);
      }
    });
  });

  describe('GET /api/trips/:id', () => {
    it('hides a draft from everyone but its owner', async () => {
      const trip = await createTrip();
      await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}`)
        .set(as(owner))
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}`)
        .set(as(other))
        .expect(404);
    });

    it('returns 400 for an ID that is not a UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/trips/not-a-uuid')
        .set(as(owner))
        .expect(400);
    });
  });

  describe('PATCH /api/trips/:id', () => {
    it('updates details and clears the description', async () => {
      const trip = await createTrip({ ...lisbon, description: 'Old' });
      const res = await request(app.getHttpServer())
        .patch(`/api/trips/${trip.id}`)
        .set(as(owner))
        .send({ title: 'Lisbon + Sintra', description: null })
        .expect(200);
      expect(res.body).toMatchObject({
        title: 'Lisbon + Sintra',
        description: null,
      });
    });

    it('rejects dates that would leave a post outside the trip', async () => {
      const trip = await createTrip();
      await addPost(trip.id, '2026-09-16');
      await request(app.getHttpServer())
        .patch(`/api/trips/${trip.id}`)
        .set(as(owner))
        .send({ endDate: '2026-09-15' })
        .expect(400);
    });

    it("returns 403 for someone else's published trip and 404 for their draft", async () => {
      const draft = await createTrip();
      await request(app.getHttpServer())
        .patch(`/api/trips/${draft.id}`)
        .set(as(other))
        .send({ title: 'Mine now' })
        .expect(404);

      const published = await createTrip();
      await addPost(published.id);
      await request(app.getHttpServer())
        .post(`/api/trips/${published.id}/publish`)
        .set(as(owner))
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/trips/${published.id}`)
        .set(as(other))
        .send({ title: 'Mine now' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/trips/${published.id}`)
        .set(as(other))
        .expect(403);
    });

    it("can't change the status directly", async () => {
      const trip = await createTrip();
      await request(app.getHttpServer())
        .patch(`/api/trips/${trip.id}`)
        .set(as(owner))
        .send({ status: 'published' })
        .expect(400);
    });
  });

  describe('POST /api/trips/:id/publish', () => {
    it('rejects a trip with no posts', async () => {
      const trip = await createTrip();
      await request(app.getHttpServer())
        .post(`/api/trips/${trip.id}/publish`)
        .set(as(owner))
        .expect(400);
    });

    it('publishes, makes the trip public, and is idempotent', async () => {
      const trip = await createTrip();
      await addPost(trip.id);

      const first = await request(app.getHttpServer())
        .post(`/api/trips/${trip.id}/publish`)
        .set(as(owner))
        .expect(200);
      const body = first.body as TripBody & { publishedAt: string };
      expect(body.status).toBe('published');
      expect(body.publishedAt).toEqual(expect.any(String));
      expect(body.postCount).toBe(1);

      const second = await request(app.getHttpServer())
        .post(`/api/trips/${trip.id}/publish`)
        .set(as(owner))
        .expect(200);
      expect((second.body as { publishedAt: string }).publishedAt).toBe(
        body.publishedAt,
      );

      await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}`)
        .set(as(other))
        .expect(200);
    });
  });

  describe('DELETE /api/trips/:id', () => {
    it('deletes the trip, its posts and media, and their S3 objects', async () => {
      const trip = await createTrip();
      const post = await addPost(trip.id);
      storageMock.deleteObjects.mockClear();

      await request(app.getHttpServer())
        .delete(`/api/trips/${trip.id}`)
        .set(as(owner))
        .expect(204);

      expect(
        await prisma.trip.findUnique({ where: { id: trip.id } }),
      ).toBeNull();
      expect(
        await prisma.post.findUnique({ where: { id: post.id } }),
      ).toBeNull();
      expect(await prisma.postMedia.count({ where: { postId: post.id } })).toBe(
        0,
      );
      expect(storageMock.deleteObjects).toHaveBeenCalledWith([
        `users/${owner.id}/posts/${trip.id}-2026-09-12.jpg`,
      ]);

      await request(app.getHttpServer())
        .get(`/api/trips/${trip.id}`)
        .set(as(owner))
        .expect(404);
    });

    it('deleting the owner deletes their trips', async () => {
      const temp = await createTestUser(prisma, 'temp');
      const trip = await prisma.trip.create({
        data: {
          ownerId: temp.id,
          title: 'Temp',
          destination: 'Nowhere',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-02'),
        },
      });
      await prisma.user.delete({ where: { id: temp.id } });
      expect(
        await prisma.trip.findUnique({ where: { id: trip.id } }),
      ).toBeNull();
    });
  });

  describe('GET /api/users/:userId/trips', () => {
    it('shows drafts only on your own profile, and paginates', async () => {
      const user = await createTestUser(prisma, 'profile');
      const make = (title: string, startDate: string, published: boolean) =>
        prisma.trip.create({
          data: {
            ownerId: user.id,
            title,
            destination: 'Somewhere',
            startDate: new Date(startDate),
            endDate: new Date(startDate),
            status: published ? 'published' : 'draft',
            publishedAt: published ? new Date() : null,
          },
        });
      await make('Oldest', '2026-01-01', true);
      await make('Middle draft', '2026-02-01', false);
      await make('Newest', '2026-03-01', true);

      const own = await request(app.getHttpServer())
        .get(`/api/users/${user.id}/trips`)
        .set({ 'x-test-user': user.id })
        .expect(200);
      expect(
        (own.body as { items: { title: string }[] }).items.map((t) => t.title),
      ).toEqual(['Newest', 'Middle draft', 'Oldest']);

      const page1 = await request(app.getHttpServer())
        .get(`/api/users/${user.id}/trips?limit=1`)
        .set(as(other))
        .expect(200);
      const body1 = page1.body as {
        items: { title: string }[];
        nextCursor: string;
      };
      expect(body1.items.map((t) => t.title)).toEqual(['Newest']);
      expect(body1.nextCursor).toEqual(expect.any(String));

      const page2 = await request(app.getHttpServer())
        .get(`/api/users/${user.id}/trips?limit=1&cursor=${body1.nextCursor}`)
        .set(as(other))
        .expect(200);
      expect(page2.body).toMatchObject({
        items: [{ title: 'Oldest' }],
        nextCursor: null,
      });

      await prisma.user.delete({ where: { id: user.id } });
    });

    it('returns 404 for a user that does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/users/user_does_not_exist/trips')
        .set(as(owner))
        .expect(404);
    });

    it('rejects a cursor from another list', async () => {
      const otherTrip = await prisma.trip.create({
        data: {
          ownerId: other.id,
          title: 'Not yours',
          destination: 'Somewhere',
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-02'),
        },
      });
      await request(app.getHttpServer())
        .get(`/api/users/${owner.id}/trips?cursor=${otherTrip.id}`)
        .set(as(owner))
        .expect(400);
    });

    it('rejects a limit over 50', async () => {
      await request(app.getHttpServer())
        .get(`/api/users/${owner.id}/trips?limit=51`)
        .set(as(owner))
        .expect(400);
    });
  });

  describe('GET /api/me/trips/active', () => {
    it('returns drafts whose dates include today, newest first', async () => {
      const user = await createTestUser(prisma, 'active');
      const make = (
        title: string,
        start: number,
        end: number,
        published = false,
      ) =>
        prisma.trip.create({
          data: {
            ownerId: user.id,
            title,
            destination: 'Somewhere',
            startDate: new Date(isoDate(start)),
            endDate: new Date(isoDate(end)),
            status: published ? 'published' : 'draft',
            publishedAt: published ? new Date() : null,
          },
        });
      await make('Started last week', -7, 2);
      await make('Started today', 0, 0);
      await make('Ended yesterday', -3, -1);
      await make('Starts tomorrow', 1, 4);
      await make('Published', -1, 1, true);

      const res = await request(app.getHttpServer())
        .get(`/api/me/trips/active?date=${isoDate()}`)
        .set({ 'x-test-user': user.id })
        .expect(200);
      expect(
        (res.body as { items: { title: string }[] }).items.map((t) => t.title),
      ).toEqual(['Started today', 'Started last week']);

      // The user's date can be a day ahead of UTC
      const tomorrow = await request(app.getHttpServer())
        .get(`/api/me/trips/active?date=${isoDate(1)}`)
        .set({ 'x-test-user': user.id })
        .expect(200);
      expect(
        (tomorrow.body as { items: { title: string }[] }).items.map(
          (t) => t.title,
        ),
      ).toEqual(['Starts tomorrow', 'Started last week']);

      await prisma.user.delete({ where: { id: user.id } });
    });

    it('rejects a date more than a day away', async () => {
      await request(app.getHttpServer())
        .get(`/api/me/trips/active?date=${isoDate(3)}`)
        .set(as(owner))
        .expect(400);
    });
  });
});
