import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type { TripInviteResponse, TripInvitesResponse } from 'shared-types';
import { Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_TRIP_PEOPLE } from '../src/trips/trip-rules';
import { createTestApp, createTestUser } from './utils/test-app';

// #134 COLLAB-3: sending, listing and cancelling invites, and the whole flow
// through accept and decline (those two are also covered in
// notifications-invites.e2e-spec.ts).
describe('Trip invites (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: User;
  let invitee: User;
  let other: User;
  // Enough extra people to fill a trip
  let crowd: User[];
  let draft: Trip;
  let published: Trip;

  const as = (user: User) => ({ 'x-test-user': user.id });
  const http = () => request(app.getHttpServer());

  const sendInvite = (from: User, to: User | string, trip = draft) =>
    http()
      .post(`/api/trips/${trip.id}/invites`)
      .set(as(from))
      .send({ username: typeof to === 'string' ? to : to.username });

  async function invite(to: User, trip = draft) {
    const res = await sendInvite(owner, to, trip).expect(201);
    return res.body as TripInviteResponse;
  }

  const notificationsOf = (user: User) =>
    prisma.notification.findMany({
      where: { recipientId: user.id, tripId: draft.id },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    owner = await createTestUser(prisma, 'owner');
    invitee = await createTestUser(prisma, 'invitee');
    other = await createTestUser(prisma, 'other');
    crowd = await Promise.all(
      Array.from({ length: MAX_TRIP_PEOPLE }, (_, i) =>
        createTestUser(prisma, `crowd${i}`),
      ),
    );
    const trip = (status: 'draft' | 'published') =>
      prisma.trip.create({
        data: {
          ownerId: owner.id,
          title: `Lisbon ${status}`,
          destination: 'Lisbon, Portugal',
          startDate: new Date('2026-12-04'),
          endDate: new Date('2026-12-08'),
          status,
          publishedAt: status === 'published' ? new Date() : null,
        },
      });
    [draft, published] = await Promise.all([trip('draft'), trip('published')]);
  });

  afterEach(async () => {
    const tripId = { in: [draft.id, published.id] };
    await prisma.notification.deleteMany({ where: { tripId } });
    await prisma.tripInvite.deleteMany({ where: { tripId } });
    await prisma.tripMember.deleteMany({ where: { tripId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        id: { in: [owner, invitee, other, ...crowd].map((u) => u.id) },
      },
    });
    await app.close();
  });

  describe('POST /api/trips/:id/invites', () => {
    it('creates a pending invite and notifies the invitee', async () => {
      const body = await invite(invitee);
      expect(body).toMatchObject({
        tripId: draft.id,
        status: 'pending',
        respondedAt: null,
        inviter: { id: owner.id },
        invitee: { id: invitee.id },
      });

      expect(await notificationsOf(invitee)).toEqual([
        expect.objectContaining({
          type: 'trip_invite',
          actorId: owner.id,
          inviteId: body.id,
        }),
      ]);
    });

    it('finds the username regardless of case or spaces', async () => {
      await sendInvite(owner, `  ${invitee.username!.toUpperCase()} `).expect(
        201,
      );
    });

    it('is a 400 to invite yourself or send a bad username', async () => {
      await sendInvite(owner, owner).expect(400);
      await sendInvite(owner, 'a.b').expect(400);
      await http()
        .post(`/api/trips/${draft.id}/invites`)
        .set(as(owner))
        .send({})
        .expect(400);
    });

    it('is a 404 for a username nobody has', async () => {
      await sendInvite(owner, 'nobody_has_this_name').expect(404);
    });

    it('is a 409 for a pending invite or someone already on the trip', async () => {
      const first = await invite(invitee);
      await sendInvite(owner, invitee).expect(409);

      await http()
        .post(`/api/invites/${first.id}/accept`)
        .set(as(invitee))
        .expect(200);
      await sendInvite(owner, invitee).expect(409);

      expect(
        await prisma.tripInvite.count({ where: { tripId: draft.id } }),
      ).toBe(1);
    });

    it('lets the owner invite again after a decline', async () => {
      const first = await invite(invitee);
      await http()
        .post(`/api/invites/${first.id}/decline`)
        .set(as(invitee))
        .expect(200);
      const again = await invite(invitee);
      expect(again.id).not.toBe(first.id);
    });

    it('counts pending invites toward the cap', async () => {
      // The owner plus 9 pending invites fills the trip
      for (const user of crowd.slice(0, MAX_TRIP_PEOPLE - 1)) {
        await invite(user);
      }
      await sendInvite(owner, invitee).expect(409);

      // Cancelling one frees a spot
      const pending = await prisma.tripInvite.findFirstOrThrow({
        where: { tripId: draft.id, status: 'pending' },
      });
      await http()
        .delete(`/api/invites/${pending.id}`)
        .set(as(owner))
        .expect(200);
      await invite(invitee);
    });

    it('never passes the cap when invites race', async () => {
      // Fill all but one spot, then send two invites at once
      for (const user of crowd.slice(0, MAX_TRIP_PEOPLE - 2)) {
        await invite(user);
      }
      const results = await Promise.all([
        sendInvite(owner, invitee),
        sendInvite(owner, other),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await prisma.tripInvite.count({
          where: { tripId: draft.id, status: 'pending' },
        }),
      ).toBe(MAX_TRIP_PEOPLE - 1);
    });

    it('never creates two pending invites for the same person', async () => {
      const results = await Promise.all([
        sendInvite(owner, invitee),
        sendInvite(owner, invitee),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    });

    it('is a 403 for a collaborator and for a published trip you are not on', async () => {
      const first = await invite(invitee);
      await http()
        .post(`/api/invites/${first.id}/accept`)
        .set(as(invitee))
        .expect(200);
      await sendInvite(invitee, other).expect(403);

      await sendInvite(other, invitee, published).expect(403);
    });

    it("is a 404 for a draft you can't see or a trip that doesn't exist", async () => {
      await sendInvite(other, invitee).expect(404);
      await http()
        .post(`/api/trips/${randomUUID()}/invites`)
        .set(as(owner))
        .send({ username: invitee.username })
        .expect(404);
      await http()
        .post('/api/trips/not-a-uuid/invites')
        .set(as(owner))
        .send({ username: invitee.username })
        .expect(400);
    });

    it('needs a signed-in user', async () => {
      await http()
        .post(`/api/trips/${draft.id}/invites`)
        .send({ username: invitee.username })
        .expect(401);
    });
  });

  describe('GET /api/trips/:id/invites', () => {
    it('lists only pending invites, newest first', async () => {
      const first = await invite(invitee);
      const second = await invite(other);
      const declined = await invite(crowd[0]);
      await http()
        .post(`/api/invites/${declined.id}/decline`)
        .set(as(crowd[0]))
        .expect(200);

      const res = await http()
        .get(`/api/trips/${draft.id}/invites`)
        .set(as(owner))
        .expect(200);
      const body = res.body as TripInvitesResponse;
      expect(body.items.map((i) => i.id)).toEqual([second.id, first.id]);
    });

    it('is owner only', async () => {
      const first = await invite(invitee);
      await http()
        .post(`/api/invites/${first.id}/accept`)
        .set(as(invitee))
        .expect(200);

      await http()
        .get(`/api/trips/${draft.id}/invites`)
        .set(as(invitee))
        .expect(403);
      await http()
        .get(`/api/trips/${published.id}/invites`)
        .set(as(other))
        .expect(403);
      await http()
        .get(`/api/trips/${draft.id}/invites`)
        .set(as(other))
        .expect(404);
    });
  });

  describe('DELETE /api/invites/:id', () => {
    it('cancels a pending invite and keeps its notification, marked read', async () => {
      const row = await invite(invitee);
      const res = await http()
        .delete(`/api/invites/${row.id}`)
        .set(as(owner))
        .expect(200);
      const body = res.body as TripInviteResponse;
      expect(body).toMatchObject({ id: row.id, status: 'cancelled' });
      expect(body.respondedAt).not.toBeNull();

      const notifications = await notificationsOf(invitee);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].readAt).not.toBeNull();
      // Cancelled is final: the invitee can't accept it anymore
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(409);
    });

    it("is a 409 once it isn't pending, including after an accept", async () => {
      const row = await invite(invitee);
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(200);
      await http().delete(`/api/invites/${row.id}`).set(as(owner)).expect(409);

      // They stay on the trip
      expect(
        await prisma.tripMember.count({
          where: { tripId: draft.id, userId: invitee.id },
        }),
      ).toBe(1);
    });

    it('is a 403 for the invitee and a 404 for anyone else', async () => {
      const row = await invite(invitee);
      await http()
        .delete(`/api/invites/${row.id}`)
        .set(as(invitee))
        .expect(403);
      await http().delete(`/api/invites/${row.id}`).set(as(other)).expect(404);
      await http()
        .delete(`/api/invites/${randomUUID()}`)
        .set(as(owner))
        .expect(404);
    });

    it("is a 409 for the invitee once there's nothing left to decline", async () => {
      const row = await invite(invitee);
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(200);
      await http()
        .delete(`/api/invites/${row.id}`)
        .set(as(invitee))
        .expect(409);
    });
  });

  describe('the whole flow', () => {
    it('invite → accept makes them a member and tells the owner', async () => {
      const row = await invite(invitee);
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(invitee))
        .expect(200);

      expect(
        await prisma.tripMember.count({
          where: { tripId: draft.id, userId: invitee.id },
        }),
      ).toBe(1);
      expect(await notificationsOf(owner)).toEqual([
        expect.objectContaining({
          type: 'trip_invite_accepted',
          actorId: invitee.id,
        }),
      ]);
    });

    it('two accepts at once create one member', async () => {
      const row = await invite(invitee);
      const results = await Promise.all([
        http().post(`/api/invites/${row.id}/accept`).set(as(invitee)),
        http().post(`/api/invites/${row.id}/accept`).set(as(invitee)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.tripMember.count({ where: { tripId: draft.id } }),
      ).toBe(1);
      expect(await notificationsOf(owner)).toHaveLength(1);
    });

    it("a stranger can't accept someone else's invite", async () => {
      const row = await invite(invitee);
      await http()
        .post(`/api/invites/${row.id}/accept`)
        .set(as(other))
        .expect(404);
      expect(
        await prisma.tripMember.count({ where: { tripId: draft.id } }),
      ).toBe(0);
    });

    it('accepting a full trip still stays at the cap', async () => {
      // 9 pending invites, all accepted at once: 10 people, never more
      const rows: { user: User; invite: TripInviteResponse }[] = [];
      for (const user of crowd.slice(0, MAX_TRIP_PEOPLE - 1)) {
        rows.push({ user, invite: await invite(user) });
      }
      await Promise.all(
        rows.map(({ user, invite: row }) =>
          http()
            .post(`/api/invites/${row.id}/accept`)
            .set(as(user))
            .expect(200),
        ),
      );
      expect(
        await prisma.tripMember.count({ where: { tripId: draft.id } }),
      ).toBe(MAX_TRIP_PEOPLE - 1);
      await sendInvite(owner, invitee).expect(409);
    });

    it('an invite racing an accept never passes the cap', async () => {
      // A full trip: the owner, 8 collaborators and 1 pending invite. While
      // that invite is accepted, the owner invites someone else. The count
      // stays at 10 throughout, so the new invite must always be refused.
      // The window this guards (the invite reading the counts while the accept
      // commits) is too narrow to hit reliably over HTTP, so this is a smoke
      // test. The guarantee comes from accept taking the trip lock FOR SHARE.
      const collaborators = crowd.slice(0, MAX_TRIP_PEOPLE - 2);
      const last = crowd[MAX_TRIP_PEOPLE - 2];
      for (let round = 0; round < 5; round++) {
        await prisma.tripMember.createMany({
          data: collaborators.map((u) => ({ tripId: draft.id, userId: u.id })),
        });
        const pending = await invite(last);

        const [accepted, invited] = await Promise.all([
          http().post(`/api/invites/${pending.id}/accept`).set(as(last)),
          sendInvite(owner, invitee),
        ]);
        expect(accepted.status).toBe(200);
        expect(invited.status).toBe(409);

        await prisma.notification.deleteMany({ where: { tripId: draft.id } });
        await prisma.tripInvite.deleteMany({ where: { tripId: draft.id } });
        await prisma.tripMember.deleteMany({ where: { tripId: draft.id } });
      }
    });
  });
});
