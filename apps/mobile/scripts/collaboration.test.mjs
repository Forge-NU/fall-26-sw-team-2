// Mocks for shared trips, buckets and saved places (#131 COLLAB-1): they
// return the shared-types shapes and follow #129 DOC-3's rules, so the UI
// issues can build against them before the endpoints exist.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/api/client.ts';
import {
  cancelTripInvite,
  listPlanningTrips,
  listTripInvites,
  listTripMembers,
  mockOthersSharedTrip,
  removeTripMember,
  sendTripInvite,
} from '../src/api/collaboration.ts';
import { addToBucket, getPlaceSavedIn, listBucket, removeBucketItem, updateBucketItem } from '../src/api/bucket.ts';
import { MOCK_PLACES, listSavedPlaces, savePlace, unsavePlace } from '../src/api/places.ts';
import { me } from '../src/api/mock-backend.ts';

process.env.EXPO_PUBLIC_API_MOCKS = 'all';

const status = (code) => (error) => error instanceof ApiError && error.status === code;

async function sharedTrip() {
  const { items } = await listPlanningTrips(null);
  return items.find((trip) => trip.memberCount > 1);
}

test('the Planning list is soonest first, with your role and counts', async () => {
  const { items, nextCursor } = await listPlanningTrips(null);
  assert.equal(nextCursor, null);
  assert.ok(items.length > 0);
  const starts = items.map((trip) => trip.startDate);
  assert.deepEqual(starts, [...starts].sort());
  for (const trip of items) {
    assert.equal(trip.myRole, 'owner');
    assert.equal(typeof trip.bucketCount, 'number');
    assert.ok(trip.memberCount >= 1);
  }
  const shared = await sharedTrip();
  assert.equal(shared.memberCount, 2);
  assert.equal(shared.bucketCount, 2);
});

test('members list the owner first', async () => {
  const shared = await sharedTrip();
  const { items } = await listTripMembers(shared.id);
  assert.deepEqual(
    items.map((m) => m.role),
    ['owner', 'collaborator'],
  );
  assert.equal(items[0].id, me.id);
  assert.ok(items.every((m) => m.joinedAt));
  await assert.rejects(listTripMembers('not-a-trip'), status(404));
});

test('invites: one pending per person, and the owner can cancel', async () => {
  const shared = await sharedTrip();
  await assert.rejects(sendTripInvite(shared.id, { username: 'nobody' }), status(404));
  await assert.rejects(sendTripInvite(shared.id, { username: 'maya.chen' }), status(409)); // already on it
  await assert.rejects(sendTripInvite(shared.id, { username: 'priya.k' }), status(409)); // already invited

  const invite = await sendTripInvite(shared.id, { username: '@Sofia.Silva' });
  assert.equal(invite.status, 'pending');
  assert.equal(invite.respondedAt, null);
  assert.equal(invite.inviter.id, me.id);
  assert.equal((await listTripInvites(shared.id)).items[0].id, invite.id);

  const cancelled = await cancelTripInvite(invite.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(cancelled.respondedAt);
  assert.ok(!(await listTripInvites(shared.id)).items.some((i) => i.id === invite.id));
  await assert.rejects(cancelTripInvite(invite.id), status(409)); // not pending anymore
  await assert.rejects(cancelTripInvite('not-an-invite'), status(404));
  // Cancelled invites don't block inviting them again
  const again = await sendTripInvite(shared.id, { username: 'sofia.silva' });
  await cancelTripInvite(again.id);
});

test("a trip you can see but aren't on is a 403, and you can't cancel an invite to you", async () => {
  const planning = new Set((await listPlanningTrips(null)).items.map((trip) => trip.id));
  const { tripId, inviteId } = mockOthersSharedTrip();
  assert.ok(!planning.has(tripId));
  await assert.rejects(listTripMembers(tripId), status(403));
  await assert.rejects(listTripInvites(tripId), status(403));
  await assert.rejects(cancelTripInvite(inviteId), status(403));
});

test("the owner can remove a collaborator but can't leave", async () => {
  const shared = await sharedTrip();
  await assert.rejects(removeTripMember(shared.id, me.id), status(400));
  const [, collaborator] = (await listTripMembers(shared.id)).items;
  await removeTripMember(shared.id, collaborator.id);
  assert.equal((await listTripMembers(shared.id)).items.length, 1);
});

test('bucket: a place once, your own notes, and the owner removes anything', async () => {
  const [trip] = (await listPlanningTrips(null)).items.filter((t) => t.bucketCount === 2);
  const { items } = await listBucket(trip.id, null);
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.location.provider, 'mapbox');
    assert.ok(item.addedBy.id);
  }

  await assert.rejects(addToBucket(trip.id, { locationId: MOCK_PLACES.pena.id }), status(409));
  await assert.rejects(addToBucket(trip.id, { locationId: 'unknown' }), status(404));
  await assert.rejects(
    addToBucket(trip.id, { locationId: MOCK_PLACES.lello.id, note: 'x'.repeat(281) }),
    status(400),
  );
  const added = await addToBucket(trip.id, { locationId: MOCK_PLACES.lello.id, note: '  Go early  ' });
  assert.equal(added.note, 'Go early');
  assert.equal(added.addedBy.id, me.id);
  assert.equal((await listBucket(trip.id, null)).items[0].id, added.id);

  const theirs = items.find((item) => item.addedBy.id !== me.id);
  await assert.rejects(updateBucketItem(theirs.id, { note: 'mine now' }), status(403));
  assert.equal((await updateBucketItem(added.id, { note: null })).note, null);

  // The owner can remove a place someone else added
  await removeBucketItem(theirs.id);
  assert.ok(!(await listBucket(trip.id, null)).items.some((item) => item.id === theirs.id));
});

test('saved places: idempotent, newest first, and saved-in shows the buckets', async () => {
  await savePlace(MOCK_PLACES.lxFactory.id);
  assert.deepEqual(await savePlace(MOCK_PLACES.lxFactory.id), { saved: true });
  const { items } = await listSavedPlaces(null);
  assert.equal(items[0].location.id, MOCK_PLACES.lxFactory.id);
  assert.ok(items[0].savedAt);

  const savedIn = await getPlaceSavedIn(MOCK_PLACES.pena.id);
  assert.equal(savedIn.savedByMe, false);
  assert.ok(savedIn.trips.some((trip) => trip.inBucket));
  assert.ok(savedIn.trips.every((trip) => trip.id && trip.title));

  assert.deepEqual(await unsavePlace(MOCK_PLACES.lxFactory.id), { saved: false });
  assert.ok(!(await listSavedPlaces(null)).items.some((s) => s.location.id === MOCK_PLACES.lxFactory.id));
  await assert.rejects(savePlace('unknown'), status(404));
});
