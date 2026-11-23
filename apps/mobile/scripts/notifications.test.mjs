// Notifications inbox (#137 NOTIF-2): the bell's badge, what each row shows,
// the optimistic Accept / Decline, and the mocks.
import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoints are live now, so force the mocks (getMockMode reads this on each call)
process.env.EXPO_PUBLIC_API_MOCKS = 'all';

import { ApiError } from '../src/api/client.ts';
import {
  acceptInvite,
  declineInvite,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
} from '../src/api/notifications.ts';
import { mockGetActiveTrips, mockGetTrip } from '../src/api/mock-backend.ts';
import {
  badgeText,
  bellLabel,
  conflictMessage,
  findInviteStatus,
  isShownNotification,
  notificationParts,
  notificationTripId,
  setInviteStatus,
  loadedSinceOpen,
} from '../src/lib/notifications.ts';
import { todayLocalIso } from '../src/utils/local-date.ts';

const maya = { id: 'maya', username: 'maya.chen', firstName: 'Maya', lastName: 'Chen', avatarUrl: null };
const trip = { id: 't1', title: 'Tokyo food crawl', startDate: '2026-12-05', endDate: '2026-12-10' };
const invite = (id, status) => ({
  id: `n-${id}`,
  type: 'trip_invite',
  actor: maya,
  trip,
  invite: { id, status },
  readAt: null,
  createdAt: '2026-11-14T10:00:00Z',
});
const joined = { ...invite('x', 'accepted'), id: 'n-joined', type: 'trip_invite_accepted', invite: null };
const pages = (...lists) => ({
  pages: lists.map((items, i) => ({ items, nextCursor: i < lists.length - 1 ? String(i + 1) : null })),
  pageParams: lists.map((_, i) => (i === 0 ? null : String(i))),
});

test('the badge is hidden at 0, shows 1 to 9, then 9+', () => {
  assert.equal(badgeText(undefined), null);
  assert.equal(badgeText(0), null);
  assert.equal(badgeText(1), '1');
  assert.equal(badgeText(9), '9');
  assert.equal(badgeText(10), '9+');
  assert.equal(badgeText(250), '9+');
});

test('the bell reads out the unread count', () => {
  assert.equal(bellLabel(0), 'Notifications');
  assert.equal(bellLabel(undefined), 'Notifications');
  assert.equal(bellLabel(3), 'Notifications, 3 unread');
});

test('rows read "{name} invited you to {trip}" and "{name} joined {trip}"', () => {
  assert.deepEqual(notificationParts(invite('i1', 'pending')), { name: 'Maya Chen', verb: ' invited you to ', trip: 'Tokyo food crawl' });
  assert.deepEqual(notificationParts(joined), { name: 'Maya Chen', verb: ' joined ', trip: 'Tokyo food crawl' });
  // No name yet: the username, like UserRow
  assert.equal(notificationParts({ ...joined, actor: { ...maya, firstName: '', lastName: '' } }).name, 'maya.chen');
});

test('only a trip you can see opens: someone joining yours, or an invite you accepted', () => {
  assert.equal(notificationTripId(joined, true), 't1');
  assert.equal(notificationTripId(invite('i1', 'accepted'), true), 't1');
  for (const status of ['pending', 'declined', 'cancelled']) {
    assert.equal(notificationTripId(invite('i1', status), true), null, status);
  }
  assert.equal(notificationTripId({ ...joined, trip: null }, true), null);
  // Until COLLAB-2, members can't see drafts, so an accepted invite doesn't
  // open its trip. The owner can always open theirs.
  assert.equal(notificationTripId(invite('i1', 'accepted')), null);
  assert.equal(notificationTripId(joined), 't1');
});

test('types this version of the app does not know stay hidden', () => {
  assert.equal(isShownNotification(invite('i1', 'pending')), true);
  assert.equal(isShownNotification(joined), true);
  assert.equal(isShownNotification({ ...joined, type: 'post_liked' }), false);
  assert.equal(isShownNotification({ ...joined, trip: null }), false);
  assert.equal(isShownNotification({ ...invite('i1', 'pending'), invite: null }), false);
});

test('Accept and Decline set the invite status on whichever page it is on, and the snapshot rolls it back', () => {
  const before = pages([invite('i1', 'pending')], [joined, invite('i2', 'pending')]);
  const after = setInviteStatus(before, 'i2', 'accepted');

  assert.equal(findInviteStatus(after, 'i2'), 'accepted');
  assert.equal(findInviteStatus(after, 'i1'), 'pending');
  // Nothing else is copied, and the snapshot is untouched for the rollback
  assert.equal(after.pages[0], before.pages[0]);
  assert.equal(after.pages[1].items[0], joined);
  assert.equal(findInviteStatus(before, 'i2'), 'pending');
});

test('an invite that is not loaded leaves the cache alone', () => {
  const data = pages([invite('i1', 'pending')]);
  assert.equal(setInviteStatus(data, 'gone', 'declined'), data);
  assert.equal(setInviteStatus(undefined, 'i1', 'declined'), undefined);
  assert.equal(findInviteStatus(data, 'gone'), null);
});

test('after a 409 the toast follows the invite as it is now', () => {
  assert.equal(conflictMessage('cancelled', 'x'), 'This invite was cancelled');
  // Deleted along with its trip
  assert.equal(conflictMessage(null, 'x'), 'This invite was cancelled');
  assert.equal(conflictMessage('accepted', 'x'), 'You already joined this trip');
  assert.equal(conflictMessage('declined', 'x'), 'You already declined this invite');
  // Still pending, so it was something else, like a full trip
  assert.equal(conflictMessage('pending', 'This trip is full'), 'This trip is full');
});

// STAND-IN mocks (until #131 COLLAB-1). They keep state, so these run in order.

test('the mock inbox has an invite in every state and an accepted-your-invite row', async () => {
  const { items, nextCursor } = await listNotifications(null);
  assert.equal(nextCursor, null);
  assert.deepEqual(
    items.filter((n) => n.invite).map((n) => n.invite.status).sort(),
    ['accepted', 'cancelled', 'declined', 'pending', 'pending', 'pending'],
  );
  assert.ok(items.some((n) => n.type === 'trip_invite_accepted'));
  const times = items.map((n) => n.createdAt);
  assert.deepEqual(times, [...times].sort().reverse(), 'newest first');
  // Every trip opens in the mock backend
  for (const n of items) assert.equal((await mockGetTrip(n.trip.id)).id, n.trip.id);
});

test('read-all clears the unread count', async () => {
  assert.equal((await getUnreadCount()).count, 4);
  await markAllNotificationsRead();
  assert.equal((await getUnreadCount()).count, 0);
});

test('accepting a pending invite works once, then 409s', async () => {
  const tokyo = (await listNotifications(null)).items.find((n) => n.trip.title === 'Tokyo food crawl');
  const accepted = await acceptInvite(tokyo.invite.id);
  assert.equal(accepted.id, tokyo.invite.id);
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.tripId, tokyo.trip.id);
  assert.equal(accepted.inviter.id, tokyo.actor.id);
  assert.ok(accepted.respondedAt);
  await assert.rejects(declineInvite(tokyo.invite.id), (error) => error instanceof ApiError && error.status === 409);
});

test('the Porto invite gets cancelled when you answer it, to show the cancelled path', async () => {
  const porto = (await listNotifications(null)).items.find((n) => n.trip.title === 'Porto long weekend');
  assert.equal(porto.invite.status, 'pending');
  await assert.rejects(acceptInvite(porto.invite.id), (error) => error instanceof ApiError && error.status === 409);
  const after = (await listNotifications(null)).items.find((n) => n.id === porto.id);
  assert.equal(after.invite.status, 'cancelled');
});

test("other people's trips stay out of your active trips", async () => {
  const { items } = await mockGetActiveTrips(todayLocalIso());
  assert.ok(items.every((t) => t.owner.id === 'user_mock'));
});

test('the inbox marks read only after a fetch that finished since it opened', () => {
  const openedAt = 1_000;
  // A cached list from an earlier visit, still refetching
  assert.equal(loadedSinceOpen(openedAt, { dataUpdatedAt: 500, isFetching: true }), false);
  // The cached list, before its refetch starts
  assert.equal(loadedSinceOpen(openedAt, { dataUpdatedAt: 500, isFetching: false }), false);
  // First load in flight
  assert.equal(loadedSinceOpen(openedAt, { dataUpdatedAt: 0, isFetching: true }), false);
  // This visit's fetch landed
  assert.equal(loadedSinceOpen(openedAt, { dataUpdatedAt: 1_200, isFetching: false }), true);
});
