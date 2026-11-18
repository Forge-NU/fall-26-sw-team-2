import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  NotificationResponse,
  PaginatedResponse,
  TripInviteResponse,
  UnreadCountResponse,
} from 'shared-types';
import { Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

// #132 NOTIF-1's inbox and #134 COLLAB-3's accept / decline. Sending invites
// isn't built yet, so the tests write invites and their notifications directly.
describe('Notifications and invite answers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let invitee: User;
  let other: User;
  let trip: Trip;

  const as = (user: User) => ({ 'x-test-user': user.id });
  const http = () => request(app.getHttpServer());

  // An invite to `trip` and the notification the invitee gets for it
  async function invite(status: 'pending' | 'cancelled' = 'pending') {
    const row = await prisma.tripInvite.create({
      data: {
        tripId: trip.id,
        inviterId: owner.id,
        inviteeId: invitee.id,
        status,
        respondedAt: status === 'pending' ? null : new Date(),
      },
    });
    await prisma.notification.create({
      data: {
        recipientId: invitee.id,
        actorId: owner.id,
        type: 'trip_invite',
        tripId: trip.id,
        inviteId: row.id,
      },
    });
    return row;
  }

  async function inbox(
    user: User,
    query: Record<string, string | number> = {},
  ) {
    const res = await http()
      .get('/api/me/notifications')
      .query(query)
      .set(as(user))
      .expect(200);
    return res.body as PaginatedResponse<NotificationResponse>;
  }

  async function unread(user: User) {
    const res = await http()
      .get('/api/me/notifications/unread-count')
      .set(as(user))
      .expect(200);
    return (res.body as UnreadCountResponse).count;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'owner');
    invitee = await createTestUser(prisma, 'invitee');
    other = await createTestUser(prisma, 'other');
    trip = await prisma.trip.create({
      data: {
        ownerId: owner.id,
        title: 'Lisbon with friends',
        destination: 'Lisbon, Portugal',
        startDate: new Date('2026-12-04'),
        endDate: new Date('2026-12-08'),
      },
    });
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { tripId: trip.id } });
    await prisma.tripInvite.deleteMany({ where: { tripId: trip.id } });
    await prisma.tripMember.deleteMany({ where: { tripId: trip.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, invitee.id, other.id] } },
    });
    await app.close();
  });

  describe('inbox', () => {
    it('shows an invite with its actor, trip and status, only to its recipient', async () => {
      const row = await invite();

      const page = await inbox(invitee);
      expect(page.nextCursor).toBeNull();
      expect(page.items).toEqual([
        expect.objectContaining({
          type: 'trip_invite',
          actor: expect.objectContaining({ id: owner.id }) as unknown,
          trip: {
            id: trip.id,
            title: 'Lisbon with friends',
            startDate: '2026-12-04',
            endDate: '2026-12-08',
          },
          invite: { id: row.id, status: 'pending' },
          readAt: null,
        }),
      ]);

      expect((await inbox(other)).items).toEqual([]);
    });

    it('pages newest first', async () => {
      await invite('cancelled');
      await invite('cancelled');
      const newest = await invite();

      const first = await inbox(invitee, { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.items[0].invite?.id).toBe(newest.id);
      expect(first.nextCursor).not.toBeNull();

      const second = await inbox(invitee, {
        limit: 2,
        cursor: first.nextCursor!,
      });
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
    });

    it("rejects another list's cursor", async () => {
      await invite('cancelled');
      await invite();
      const { nextCursor } = await inbox(invitee, { limit: 1 });
      await http()
        .get('/api/me/notifications')
        .query({ cursor: nextCursor! })
        .set(as(other))
        .expect(400);
    });

    it('counts unread until read-all', async () => {
      await invite();
      await invite('cancelled');
      expect(await unread(invitee)).toBe(2);
      expect(await unread(other)).toBe(0);

      await http()
        .post('/api/me/notifications/read-all')
        .set(as(invitee))
        .expect(204);

      expect(await unread(invitee)).toBe(0);
      expect((await inbox(invitee)).items.every((n) => n.readAt)).toBe(true);
    });

    it('needs a signed-in user', async () => {
      await http().get('/api/me/notifications').expect(401);
    });
  });

  describe('accept', () => {
    it('joins the trip, tells the owner and marks the invite read', async () => {
      const row = await invite();

      const res = await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(200);
      const body = res.body as TripInviteResponse;
      expect(body).toMatchObject({
        id: row.id,
        tripId: trip.id,
        status: 'accepted',
        inviter: { id: owner.id },
        invitee: { id: invitee.id },
      });
      expect(body.respondedAt).not.toBeNull();

      const member = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId: trip.id, userId: invitee.id } },
      });
      expect(member).not.toBeNull();

      const ownerInbox = await inbox(owner);
      expect(ownerInbox.items).toEqual([
        expect.objectContaining({
          type: 'trip_invite_accepted',
          actor: expect.objectContaining({ id: invitee.id }) as unknown,
          trip: expect.objectContaining({ id: trip.id }) as unknown,
          invite: null,
        }),
      ]);
      expect(await unread(invitee)).toBe(0);
      expect((await inbox(invitee)).items[0].invite?.status).toBe('accepted');
    });

    it("is a 409 once it isn't pending", async () => {
      const row = await invite();
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(200);
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(409);
      await http()
        .post(`/api/invites/${row.id}/decline`)
        .set(as(invitee))
        .expect(409);

      const cancelled = await invite('cancelled');
      await http()
        .post(`/api/invites/${cancelled.id}/accept`)
        .set(as(invitee))
        .expect(409);
    });

    it("is a 404 for someone else's invite or one that doesn't exist", async () => {
      const row = await invite();
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(other))
        .expect(404);
      // Not even the owner can answer for the invitee
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(owner))
        .expect(404);
      await http()
        .post(`/api/invites/${randomUUID()}/accept`)
        .set(as(invitee))
        .expect(404);
      await http()
        .post('/api/invites/not-a-uuid/accept')
        .set(as(invitee))
        .expect(400);

      expect(
        await prisma.tripMember.count({ where: { tripId: trip.id } }),
      ).toBe(0);
    });
  });

  describe('decline', () => {
    it("doesn't join the trip or tell the owner", async () => {
      const row = await invite();

      const res = await http()
        .post(`/api/invites/${row.id}/decline`)
        .set(as(invitee))
        .expect(200);
      expect(res.body).toMatchObject({ id: row.id, status: 'declined' });

      expect(
        await prisma.tripMember.count({ where: { tripId: trip.id } }),
      ).toBe(0);
      expect((await inbox(owner)).items).toEqual([]);
      expect(await unread(invitee)).toBe(0);
    });

    it('lets the owner invite the same person again', async () => {
      const first = await invite();
      await http()
        .post(`/api/invites/${first.id}/decline`)
        .set(as(invitee))
        .expect(200);

      const again = await invite();
      await http()
        .post(`/api/invites/${again.id}/accept`)
        .set(as(invitee))
        .expect(200);
    });
  });
});
