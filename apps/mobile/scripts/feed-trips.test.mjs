import assert from 'node:assert/strict';
import { test } from 'node:test';

import { feedTrips, itineraryToFeedTrip, itineraryToTrip } from '../src/data/feed-trips.ts';
import { Itineraries } from '../src/data/mock.ts';

const lisbon = Itineraries.find((itinerary) => itinerary.id === 'lisbon');

test('maps a mock itinerary to a published TripResponse', () => {
  const trip = itineraryToTrip(lisbon);
  assert.equal(trip.id, 'lisbon');
  assert.equal(trip.title, lisbon.title);
  assert.equal(trip.destination, 'Lisbon, Portugal');
  assert.equal(trip.description, lisbon.summary);
  assert.equal(trip.status, 'published');
  assert.equal(trip.startDate, '2026-10-12');
  // Five days, so it ends four days after it starts
  assert.equal(trip.endDate, '2026-10-16');
  assert.equal(trip.saveCount, 84);
  assert.equal(trip.savedByMe, false);
  assert.equal(trip.coverImageUrl, null);
  assert.equal(trip.postCount, lisbon.days.reduce((n, day) => n + day.moments.length, 0));
  assert.deepEqual(trip.owner, {
    id: 'maya',
    firstName: 'Maya',
    lastName: 'Chen',
    username: 'maya',
    avatarUrl: null,
  });
});

test('every TripResponse field is set', () => {
  const trip = itineraryToTrip(lisbon);
  for (const key of [
    'id', 'owner', 'title', 'destination', 'description', 'startDate', 'endDate', 'status',
    'publishedAt', 'postCount', 'coverImageUrl', 'saveCount', 'savedByMe', 'createdAt', 'updatedAt',
  ]) {
    assert.ok(key in trip, key);
  }
  assert.ok(!Number.isNaN(Date.parse(trip.publishedAt)));
  assert.ok(trip.createdAt <= trip.updatedAt);
});

test('day previews carry the day number and its date', () => {
  const card = itineraryToFeedTrip(lisbon);
  assert.deepEqual(
    card.dayPreviews.map((day) => [day.day, day.title, day.visitedOn]),
    [
      [1, 'Belém & Alfama', '2026-10-12'],
      [2, 'Chiado & LX Factory', '2026-10-13'],
      [3, 'Sintra day trip', '2026-10-14'],
      [4, 'More to explore', '2026-10-15'],
      [5, 'One last wander', '2026-10-16'],
    ],
  );
  assert.equal(card.meta, 'Lisbon, Portugal · 18m · Sharing itinerary');
  assert.equal(card.verified, true);
  assert.equal(card.stops, 24);
});

test('feedTrips filters by tab', () => {
  assert.deepEqual(feedTrips('fyp').map((card) => card.trip.id), ['lisbon', 'copenhagen']);
  assert.deepEqual(feedTrips('local').map((card) => card.trip.id), ['lisbon']);
});
