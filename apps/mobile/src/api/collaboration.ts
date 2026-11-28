// Trip members, invites and the Planning list for #138 COLLAB-4 and #140
// BUCKET-2, on #133 COLLAB-2's and #134 COLLAB-3's endpoints (contract in
// #131 COLLAB-1, docs/architecture/shared-trips.md). Sending, listing and
// cancelling invites are live (#134); the rest return mock data until #133
// COLLAB-2 merges. Accepting and declining an invite are live, in
// api/notifications.ts.
//
// Rules (#129 DOC-3): a trip has one owner and up to 9 collaborators, 10 people
// in all, counting pending invites. Only the owner invites, cancels invites and
// removes collaborators; a collaborator can leave at any time.
import type {
  CreateTripInviteRequest,
  PaginatedResponse,
  PlanningTripResponse,
  TripInviteResponse,
  TripInvitesResponse,
  TripMemberResponse,
  TripMembersResponse,
  UserSummary,
} from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { maya, me, mockOthersTrip, mockOwnTrips, priya } from '@/api/mock-backend';
import { mockBucketCount } from '@/api/bucket';

/** The API's limit, from apps/api/src/trips/trip-rules.ts */
export const MAX_TRIP_PEOPLE = 10;

const tripPath = (id: string) => `/api/trips/${encodeURIComponent(id)}`;
const invitePath = (id: string) => `/api/invites/${encodeURIComponent(id)}`;

/** Everyone on a trip: the owner first, then collaborators by when they joined. Members only. */
export const listTripMembers = withMock<[tripId: string, signal?: AbortSignal], TripMembersResponse>({
  live: false, // true once #133 COLLAB-2 merges
  real: (tripId, signal) => apiGet(`${tripPath(tripId)}/members`, undefined, { signal }),
  mock: async (tripId) => {
    await mockDelay();
    const path = `${tripPath(tripId)}/members`;
    const trip = tripOf(tripId, path);
    if (!trip.members.some((m) => m.id === me.id)) mockError(403, "You're not on this trip", path);
    return { items: trip.members.map((m) => ({ ...m })) };
  },
});

/**
 * The owner removes a collaborator, or a collaborator passes their own id to
 * leave. 403 for anyone else, 400 if the owner tries to leave their own trip.
 */
export const removeTripMember = withMock<[tripId: string, userId: string], void>({
  live: false, // true once #133 COLLAB-2 merges
  real: async (tripId, userId) => {
    await apiRequest('DELETE', `${tripPath(tripId)}/members/${encodeURIComponent(userId)}`);
  },
  mock: async (tripId, userId) => {
    await mockDelay();
    const path = `${tripPath(tripId)}/members/${userId}`;
    const trip = tripOf(tripId, path);
    if (userId === trip.ownerId) mockError(400, "The owner can't leave their own trip", path);
    if (userId !== me.id && trip.ownerId !== me.id) mockError(403, 'Only the owner can remove collaborators', path);
    const index = trip.members.findIndex((m) => m.id === userId);
    if (index === -1) mockError(404, 'Member not found', path);
    trip.members.splice(index, 1);
  },
});

/** Trips you own or joined, soonest first. */
export const listPlanningTrips = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<PlanningTripResponse>
>({
  live: false, // true once #133 COLLAB-2 merges
  real: (cursor, signal) => apiGet('/api/me/trips/planning', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    const trips = mockOwnTrips()
      .map((trip): PlanningTripResponse => ({
        ...trip,
        myRole: 'owner',
        memberCount: tripOf(trip.id, '').members.length,
        bucketCount: mockBucketCount(trip.id),
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
    return mockPage(trips, cursor);
  },
});

/**
 * Owner only. 404 for an unknown username; 409 if they're already on the trip,
 * already invited, or the trip is full.
 */
export const sendTripInvite = withMock<[tripId: string, body: CreateTripInviteRequest], TripInviteResponse>({
  live: true, // #134 COLLAB-3
  real: (tripId, body) => apiRequest('POST', `${tripPath(tripId)}/invites`, body),
  mock: async (tripId, { username }) => {
    await mockDelay();
    const path = `${tripPath(tripId)}/invites`;
    const trip = tripOf(tripId, path);
    if (trip.ownerId !== me.id) mockError(403, 'Only the owner can invite people', path);
    const invitee =
      INVITABLE.find((user) => user.username === username.trim().replace(/^@/, '').toLowerCase()) ??
      mockError(404, 'User not found', path);
    if (trip.members.some((m) => m.id === invitee.id)) mockError(409, `${invitee.firstName} is already on this trip`, path);
    const pending = trip.invites.filter((i) => i.status === 'pending');
    if (pending.some((i) => i.invitee.id === invitee.id)) mockError(409, `${invitee.firstName} is already invited`, path);
    if (trip.members.length + pending.length >= MAX_TRIP_PEOPLE) {
      mockError(409, `A trip has up to ${MAX_TRIP_PEOPLE} people, counting pending invites`, path);
    }
    const invite: TripInviteResponse = {
      id: `invite-${nextId++}`,
      tripId,
      inviter: me,
      invitee,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    trip.invites.unshift(invite);
    return { ...invite };
  },
});

/** A trip's pending invites, newest first. Owner only. */
export const listTripInvites = withMock<[tripId: string, signal?: AbortSignal], TripInvitesResponse>({
  live: true, // #134 COLLAB-3
  real: (tripId, signal) => apiGet(`${tripPath(tripId)}/invites`, undefined, { signal }),
  mock: async (tripId) => {
    await mockDelay();
    const path = `${tripPath(tripId)}/invites`;
    const trip = tripOf(tripId, path);
    if (trip.ownerId !== me.id) mockError(403, 'Only the owner can see invites', path);
    return { items: trip.invites.filter((i) => i.status === 'pending').map((i) => ({ ...i })) };
  },
});

/**
 * Owner only. 403 for the invitee (decline instead), 409 if it isn't pending
 * anymore. The invite stays, as cancelled, like the real one.
 */
export const cancelTripInvite = withMock<[inviteId: string], TripInviteResponse>({
  live: true, // #134 COLLAB-3
  real: (inviteId) => apiRequest('DELETE', invitePath(inviteId)),
  mock: async (inviteId) => {
    await mockDelay();
    seedTrips();
    const path = invitePath(inviteId);
    for (const trip of trips.values()) {
      const invite = trip.invites.find((i) => i.id === inviteId);
      if (!invite) continue;
      if (invite.invitee.id === me.id) mockError(403, 'Decline the invite instead', path);
      if (trip.ownerId !== me.id) break; // Not yours to see
      if (invite.status !== 'pending') mockError(409, 'This invite is no longer pending', path);
      invite.status = 'cancelled';
      invite.respondedAt = new Date().toISOString();
      return { ...invite };
    }
    return mockError(404, 'Invite not found', path);
  },
});

// Mock data: each of the mock user's trips. The first has Maya as a
// collaborator and a pending invite to Priya. There's also Maya's published
// trip with Priya, which the mock user can see but isn't on (403), and a
// pending invite from Maya to the mock user on it. Other trips are a 404, as
// if you couldn't see them.

type MockSharedTrip = { ownerId: string; members: TripMemberResponse[]; invites: TripInviteResponse[] };

const DAY_MS = 24 * 60 * 60 * 1000;
let nextId = 1;
let trips = new Map<string, MockSharedTrip>();
let seeded = false;

/** People the mock user can invite, by username */
const INVITABLE: UserSummary[] = [
  maya,
  priya,
  { id: 'user_sofia', username: 'sofia.silva', firstName: 'Sofia', lastName: 'Silva', avatarUrl: null },
  { id: 'user_kenji', username: 'kenji.t', firstName: 'Kenji', lastName: 'Tanaka', avatarUrl: null },
];

function seedTrips() {
  if (seeded) return;
  seeded = true;
  const ago = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
  trips = new Map(
    mockOwnTrips().map((trip) => [
      trip.id,
      { ownerId: me.id, members: [{ ...me, role: 'owner', joinedAt: trip.createdAt }], invites: [] },
    ]),
  );
  const others = mockOthersTrip(maya, 'Lisbon tram day', 'Lisbon, Portugal', ago(-30).slice(0, 10), ago(-28).slice(0, 10));
  others.status = 'published';
  others.publishedAt = ago(3);
  trips.set(others.id, {
    ownerId: maya.id,
    members: [
      { ...maya, role: 'owner', joinedAt: others.createdAt },
      { ...priya, role: 'collaborator', joinedAt: ago(3) },
    ],
    invites: [
      {
        id: `invite-${nextId++}`,
        tripId: others.id,
        inviter: maya,
        invitee: me,
        status: 'pending',
        createdAt: ago(1),
        respondedAt: null,
      },
    ],
  });

  const [first] = mockOwnTrips();
  const shared = first && trips.get(first.id);
  if (!shared) return;
  shared.members.push({ ...maya, role: 'collaborator', joinedAt: ago(2) });
  shared.invites.push({
    id: `invite-${nextId++}`,
    tripId: first.id,
    inviter: me,
    invitee: priya,
    status: 'pending',
    createdAt: ago(1),
    respondedAt: null,
  });
}

/** Maya's mock trip that the mock user can see but isn't on, and her invite to them, for the 403 states */
export function mockOthersSharedTrip(): { tripId: string; inviteId: string } {
  seedTrips();
  for (const [tripId, trip] of trips) {
    if (trip.ownerId !== me.id) return { tripId, inviteId: trip.invites[0].id };
  }
  throw new Error('No mock trip of someone else');
}

function tripOf(tripId: string, path: string): MockSharedTrip {
  seedTrips();
  return trips.get(tripId) ?? mockError(404, 'Trip not found', path);
}
