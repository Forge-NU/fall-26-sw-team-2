// Notifications inbox for NOTIF-2 (#137): #132 NOTIF-1's inbox endpoints and
// #134 COLLAB-3's accept / decline, built with the contract in #131 COLLAB-1
// (docs/architecture/shared-trips.md). Sending invites is still mocked, in
// api/collaboration.ts.
import type {
  NotificationResponse,
  PaginatedResponse,
  TripInviteResponse,
  TripInviteStatus,
  UnreadCountResponse,
  UserSummary,
} from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { maya, me, mockOthersTrip, mockOwnTrips, priya } from '@/api/mock-backend';
import { addDays, todayLocalIso } from '@/utils/local-date';

const invitePath = (id: string) => `/api/invites/${encodeURIComponent(id)}`;

/** Your notifications, newest first. */
export const listNotifications = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<NotificationResponse>
>({
  live: true,
  real: (cursor, signal) => apiGet('/api/me/notifications', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    return mockPage(mockNotifications().map(copy), cursor);
  },
});

export const getUnreadCount = withMock<[signal?: AbortSignal], UnreadCountResponse>({
  live: true,
  real: (signal) => apiGet('/api/me/notifications/unread-count', undefined, { signal }),
  mock: async () => {
    await mockDelay();
    return { count: mockNotifications().filter((n) => !n.readAt).length };
  },
});

/** Marks everything as read. The inbox calls it when it opens. */
export const markAllNotificationsRead = withMock<[], void>({
  live: true,
  real: async () => {
    await apiRequest('POST', '/api/me/notifications/read-all');
  },
  mock: async () => {
    await mockDelay();
    const now = new Date().toISOString();
    for (const n of mockNotifications()) n.readAt ??= now;
  },
});

/**
 * Joins the trip as a collaborator, and the owner gets a notification.
 * 404 for someone else's invite, 409 when it isn't pending anymore.
 */
export const acceptInvite = withMock<[inviteId: string], TripInviteResponse>({
  live: true,
  real: (inviteId) => apiRequest('POST', `${invitePath(inviteId)}/accept`),
  mock: (inviteId) => mockRespond(inviteId, 'accepted'),
});

/** Sends nothing back to the owner. 404 for someone else's invite, 409 when it isn't pending anymore. */
export const declineInvite = withMock<[inviteId: string], TripInviteResponse>({
  live: true,
  real: (inviteId) => apiRequest('POST', `${invitePath(inviteId)}/decline`),
  mock: (inviteId) => mockRespond(inviteId, 'declined'),
});

// Mock data: an invite in every state plus an "accepted your invite", on trips
// that exist in mock-backend.ts so tapping through opens the trip page.
//
// The pending invite to Porto gets cancelled by its owner the moment you answer
// it, so Accept or Decline on it shows "This invite was cancelled".

const person = (id: string, firstName: string, lastName: string): UserSummary => ({
  id,
  username: `${firstName}.${lastName}`.toLowerCase(),
  firstName,
  lastName,
  avatarUrl: null,
});

const MINUTE_MS = 60 * 1000;
let notifications: NotificationResponse[] | null = null;
/** Invites the owner cancels as soon as you answer them */
const cancelOnAnswer = new Set<string>();

function mockNotifications(): NotificationResponse[] {
  if (notifications) return notifications;
  const today = todayLocalIso();
  const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE_MS).toISOString();
  const tripSummary = (trip: { id: string; title: string; startDate: string; endDate: string }) => ({
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });
  const invite = (
    id: string,
    actor: UserSummary,
    title: string,
    destination: string,
    startIn: number,
    days: number,
    status: TripInviteStatus,
    minutesAgo: number,
  ): NotificationResponse => {
    const start = addDays(today, startIn);
    const trip = mockOthersTrip(actor, title, destination, start, addDays(start, days - 1));
    return {
      id: `notif-${id}`,
      type: 'trip_invite',
      actor,
      trip: tripSummary(trip),
      invite: { id: `invite-${id}`, status },
      readAt: status === 'pending' ? null : ago(minutesAgo - 5),
      createdAt: ago(minutesAgo),
    };
  };

  const kyoto = mockOwnTrips().find((trip) => trip.title === 'Kyoto, someday') ?? mockOwnTrips()[0];
  const sofia = person('user_sofia', 'Sofia', 'Silva');

  notifications = [
    invite('tokyo', maya, 'Tokyo food crawl', 'Tokyo, Japan', 21, 6, 'pending', 20),
    invite('porto', sofia, 'Porto long weekend', 'Porto, Portugal', 10, 4, 'pending', 3 * 60),
    {
      id: 'notif-kyoto-joined',
      type: 'trip_invite_accepted',
      actor: priya,
      trip: tripSummary(kyoto),
      invite: null,
      readAt: null,
      createdAt: ago(26 * 60),
    },
    invite('dolomites', person('user_lucas', 'Lucas', 'Martin'), 'Dolomites hut to hut', 'Cortina, Italy', 200, 5, 'pending', 2 * 24 * 60),
    invite('iceland', person('user_noah', 'Noah', 'Okafor'), 'Iceland ring road', 'Reykjavík, Iceland', 45, 8, 'accepted', 3 * 24 * 60),
    invite('marrakech', person('user_amara', 'Amara', 'Haddad'), 'Marrakech in March', 'Marrakech, Morocco', 120, 5, 'declined', 5 * 24 * 60),
    invite('seoul', person('user_kenji', 'Kenji', 'Tanaka'), 'Seoul cafés', 'Seoul, South Korea', 60, 4, 'cancelled', 8 * 24 * 60),
  ];
  cancelOnAnswer.add('invite-porto');
  return notifications;
}

function copy(n: NotificationResponse): NotificationResponse {
  return { ...n, invite: n.invite && { ...n.invite } };
}

async function mockRespond(inviteId: string, status: 'accepted' | 'declined'): Promise<TripInviteResponse> {
  await mockDelay();
  const path = `${invitePath(inviteId)}/${status === 'accepted' ? 'accept' : 'decline'}`;
  const notification =
    mockNotifications().find((n) => n.invite?.id === inviteId) ?? mockError(404, 'Invite not found', path);
  const invite = notification.invite!;
  if (cancelOnAnswer.has(inviteId) && invite.status === 'pending') invite.status = 'cancelled';
  if (invite.status !== 'pending') mockError(409, 'This invite is no longer pending', path);
  invite.status = status;
  // Answering it counts as reading it, like the API
  notification.readAt ??= new Date().toISOString();
  return {
    id: invite.id,
    tripId: notification.trip!.id,
    inviter: notification.actor,
    invitee: me,
    status,
    createdAt: notification.createdAt,
    respondedAt: new Date().toISOString(),
  };
}
