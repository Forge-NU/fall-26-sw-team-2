import { INestApplication } from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser, storageMock } from './utils/test-app';

const mockGetClerkUser = jest.fn();
const mockDeleteClerkUser = jest.fn();
const mockUpdateClerkUser = jest.fn();

jest.mock('../src/auth/clerk.client', () => ({
  clerkClient: {
    users: {
      getUser: (id: string): unknown => mockGetClerkUser(id),
      deleteUser: (id: string): unknown => mockDeleteClerkUser(id),
      updateUser: (id: string, params: unknown): unknown =>
        mockUpdateClerkUser(id, params),
    },
  },
}));

// Signs the body the way Clerk (Svix) does, so the real webhook verification
// runs.
const signingSecret = `whsec_${randomBytes(24).toString('base64')}`;

function signedWebhook(event: Record<string, unknown>) {
  const id = `msg_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify(event);
  const key = Buffer.from(signingSecret.slice('whsec_'.length), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
  };
}

describe('Users and onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const createdIds: string[] = [];

  const as = (id: string) => ({ 'x-test-user': id });

  function clerkUser(id: string) {
    return {
      id,
      first_name: null,
      last_name: null,
      image_url: '',
      primary_email_address_id: 'email_1',
      email_addresses: [
        { id: 'email_1', email_address: `${id.toLowerCase()}@example.com` },
      ],
    };
  }

  function deliver(event: Record<string, unknown>) {
    const { body, headers } = signedWebhook(event);
    return request(app.getHttpServer())
      .post('/api/webhooks/clerk')
      .set(headers)
      .send(body);
  }

  async function signUp(name: string) {
    const id = `user_test_${name}_${suffix}`;
    createdIds.push(id);
    await deliver({ type: 'user.created', data: clerkUser(id) }).expect(200);
    return id;
  }

  function onboard(id: string, username: string) {
    return request(app.getHttpServer())
      .post('/api/me/profile')
      .set(as(id))
      .send({ firstName: 'Test', lastName: 'User', username });
  }

  beforeAll(async () => {
    process.env['CLERK_WEBHOOK_SIGNING_SECRET'] = signingSecret;
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClerkUser.mockImplementation((id: string) =>
      Promise.resolve({
        id,
        primaryEmailAddressId: null,
        emailAddresses: [],
        imageUrl: '',
      }),
    );
    mockDeleteClerkUser.mockResolvedValue(undefined);
    mockUpdateClerkUser.mockResolvedValue({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  describe('Clerk webhook', () => {
    it('creates exactly one row with no username, even when retried', async () => {
      const id = await signUp('webhook');
      await deliver({ type: 'user.created', data: clerkUser(id) }).expect(200);

      const rows = await prisma.user.findMany({ where: { id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ username: null, firstName: '' });

      const me = await request(app.getHttpServer())
        .get('/api/me')
        .set(as(id))
        .expect(200);
      expect(me.body).toMatchObject({ id, username: null });
    });

    it('rejects an unsigned delivery', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/clerk')
        .send({ type: 'user.created', data: clerkUser('user_forged') })
        .expect(400);
      expect(
        await prisma.user.findUnique({ where: { id: 'user_forged' } }),
      ).toBeNull();
    });

    it('removes the row on user.deleted', async () => {
      const id = await signUp('clerkdeleted');
      await deliver({
        type: 'user.deleted',
        data: { id, deleted: true },
      }).expect(200);
      expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
    });
  });

  describe('POST /api/me/profile', () => {
    it('completes the webhook-created row instead of adding one', async () => {
      const id = await signUp('onboard');
      const res = await onboard(id, `New_${suffix}`).expect(201);

      expect(res.body).toMatchObject({ id, username: `new_${suffix}` });
      expect(await prisma.user.count({ where: { id } })).toBe(1);
    });

    it('creates the row if onboarding beats the webhook', async () => {
      const id = `user_test_early_${suffix}`;
      createdIds.push(id);
      await onboard(id, `early_${suffix}`).expect(201);
      await deliver({ type: 'user.created', data: clerkUser(id) }).expect(200);

      const rows = await prisma.user.findMany({ where: { id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe(`early_${suffix}`);
    });

    it('rejects a username that differs only by case', async () => {
      const first = await signUp('christian1');
      const second = await signUp('christian2');
      await onboard(first, `Christian_${suffix}`).expect(201);

      await onboard(second, `christian_${suffix}`).expect(409);
      await onboard(second, `CHRISTIAN_${suffix}`).expect(409);
    });

    it('keeps the database unchanged if Clerk rejects the username', async () => {
      const id = await signUp('clerkreject');
      mockUpdateClerkUser.mockRejectedValue({
        errors: [{ code: 'form_identifier_exists' }],
      });

      await onboard(id, `clerkreject_${suffix}`).expect(409);
      expect(
        (await prisma.user.findUnique({ where: { id } }))?.username,
      ).toBeNull();
    });

    it('rejects invalid usernames', async () => {
      const id = await signUp('invalid');
      for (const username of [
        'abc',
        'has.period',
        'has space',
        'emoji🙂',
        'a'.repeat(31),
      ]) {
        await onboard(id, username).expect(400);
      }
    });
  });

  it('enforces case-insensitive uniqueness in the database', async () => {
    const user = await createTestUser(prisma, 'dbcase');
    createdIds.push(user.id);

    await expect(
      prisma.user.create({
        data: {
          id: `user_test_dbcase2_${suffix}`,
          firstName: 'Db',
          lastName: 'Case',
          username: user.username!.toUpperCase(),
        },
      }),
    ).rejects.toThrow();
  });

  it('allows many users without a username yet', async () => {
    await signUp('nullname1');
    await signUp('nullname2');
  });

  describe('GET /api/users/username-availability', () => {
    it('reports availability case-insensitively', async () => {
      const id = await signUp('avail');
      await onboard(id, `taken_${suffix}`).expect(201);

      const check = (username: string) =>
        request(app.getHttpServer())
          .get('/api/users/username-availability')
          .query({ username })
          .set(as(id))
          .expect(200);

      expect((await check(`TAKEN_${suffix}`)).body).toEqual({
        available: false,
      });
      expect((await check(`free_${suffix}`)).body).toEqual({
        available: true,
      });
    });

    it('rejects an invalid username', async () => {
      const id = await signUp('availbad');
      await request(app.getHttpServer())
        .get('/api/users/username-availability')
        .query({ username: 'a b' })
        .set(as(id))
        .expect(400);
    });
  });

  describe('GET /api/users/:username', () => {
    it('finds a profile regardless of capitalization', async () => {
      const id = await signUp('lookup');
      await onboard(id, `lookup_${suffix}`).expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/users/LOOKUP_${suffix}`)
        .set(as(id))
        .expect(200);
      expect(res.body).toMatchObject({ id, username: `lookup_${suffix}` });
    });

    it('returns 404 for an unknown username', async () => {
      const id = await signUp('lookupmiss');
      await request(app.getHttpServer())
        .get(`/api/users/nobody_${suffix}`)
        .set(as(id))
        .expect(404);
    });
  });

  describe('DELETE /api/me', () => {
    it('deletes the Clerk user, every row the user owns, and their S3 media', async () => {
      const id = await signUp('deleteme');
      await onboard(id, `deleteme_${suffix}`).expect(201);
      const friend = await signUp('friend');

      const trip = await prisma.trip.create({
        data: {
          ownerId: id,
          title: 'Trip',
          destination: 'Lisbon',
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-16'),
        },
      });
      const post = await prisma.post.create({
        data: {
          tripId: trip.id,
          visitedOn: new Date('2026-09-12'),
          customLocationName: 'Somewhere',
          media: {
            create: [
              { s3Key: `users/${id}/a.jpg`, mediaType: 'image', position: 0 },
              { s3Key: `users/${id}/b.mp4`, mediaType: 'video', position: 1 },
            ],
          },
        },
      });
      await prisma.follow.createMany({
        data: [
          { followerId: id, followingId: friend },
          { followerId: friend, followingId: id },
        ],
      });

      await request(app.getHttpServer())
        .delete('/api/me')
        .set(as(id))
        .expect(204);

      expect(mockDeleteClerkUser).toHaveBeenCalledWith(id);
      expect(storageMock.deleteObjectsStrict).toHaveBeenCalledWith(
        expect.arrayContaining([`users/${id}/a.jpg`, `users/${id}/b.mp4`]),
      );
      expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
      expect(
        await prisma.trip.findUnique({ where: { id: trip.id } }),
      ).toBeNull();
      expect(
        await prisma.post.findUnique({ where: { id: post.id } }),
      ).toBeNull();
      expect(await prisma.postMedia.count({ where: { postId: post.id } })).toBe(
        0,
      );
      expect(
        await prisma.follow.count({
          where: { OR: [{ followerId: id }, { followingId: id }] },
        }),
      ).toBe(0);
      expect(
        await prisma.user.findUnique({ where: { id: friend } }),
      ).not.toBeNull();
    });

    it('keeps everything if S3 deletion fails', async () => {
      const id = await signUp('s3fail');
      storageMock.deleteObjectsStrict.mockRejectedValueOnce(
        new Error('S3 down'),
      );

      await request(app.getHttpServer())
        .delete('/api/me')
        .set(as(id))
        .expect(500);

      expect(mockDeleteClerkUser).not.toHaveBeenCalled();
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
    });
  });
});
