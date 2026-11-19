// #143 POST-4: a post's location is optional. How a post with none shows on
// the trip page, the places count, the rating rule, and the mock API.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/api/client.ts';
import { mockCreatePost, mockCreateTrip, mockResolveLocation, mockUpdatePost } from '../src/api/mock-backend.ts';
import { canRateLocation } from '../src/lib/picked-location.ts';
import { countPlaces, groupByPlace, postPlaceName } from '../src/lib/post-location.ts';
import { todayLocalIso } from '../src/utils/local-date.ts';

const place = (id, name) => ({ location: { id, name }, customLocationName: null });
const custom = (name) => ({ location: null, customLocationName: name });
const none = () => ({ location: null, customLocationName: null });

test('a post with no location has no place name, so no location row', () => {
  assert.equal(postPlaceName(place('loc-1', 'Pena Palace')), 'Pena Palace');
  assert.equal(postPlaceName(custom('Tram 28')), 'Tram 28');
  assert.equal(postPlaceName(none()), null);
});

test('the places count skips posts with no location', () => {
  assert.equal(countPlaces([]), 0);
  assert.equal(countPlaces([none(), none()]), 0);
  // Same place twice, the same custom name twice, and two with nothing
  assert.equal(
    countPlaces([place('loc-1', 'Pena'), place('loc-1', 'Pena'), custom('Tram 28'), custom('Tram 28'), none(), none()]),
    2,
  );
  // A custom name that happens to match a place's name is still its own place
  assert.equal(countPlaces([place('loc-1', 'Pena'), custom('Pena')]), 2);
});

test('posts with no location are never grouped under a place', () => {
  const groups = groupByPlace([
    { id: 'a', ...place('loc-1', 'Pena') },
    { id: 'b', ...place('loc-1', 'Pena') },
    { id: 'c', ...none() },
    { id: 'd', ...none() },
    { id: 'e', ...custom('Tram 28') },
    { id: 'f', ...none() },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.name, g.posts.map((p) => p.id)]),
    [
      ['Pena', ['a', 'b']],
      [null, ['c', 'd']],
      ['Tram 28', ['e']],
      [null, ['f']],
    ],
  );
});

test('only a Mapbox place or a dropped pin can be rated (the rating row shows for a locationId)', () => {
  assert.equal(canRateLocation({ kind: 'mapbox', location: { id: 'loc-1' } }), true);
  assert.equal(canRateLocation({ kind: 'pin', location: { id: 'pin-1' } }), true);
  assert.equal(canRateLocation({ kind: 'custom', name: 'Tram 28' }), false);
  assert.equal(canRateLocation(null), false);
});

const isBadRequest = (pattern) => (error) =>
  error instanceof ApiError && error.status === 400 && pattern.test(error.message);

test('mock: create takes no location, but not both kinds or a rating without a place', async () => {
  const today = todayLocalIso();
  const trip = await mockCreateTrip({ title: 'No location', destination: 'Lisbon, Portugal', startDate: today, endDate: today });
  const media = [{ s3Key: 'users/user_mock/posts/x.jpg', mediaType: 'image' }];
  const { location } = await mockResolveLocation({
    kind: 'mapbox',
    mapboxId: 'mock.post-4',
    name: 'Pena Palace',
    latitude: 38.787586,
    longitude: -9.390616,
  });

  const post = await mockCreatePost({ tripId: trip.id, visitedOn: today, media });
  assert.equal(post.location, null);
  assert.equal(post.customLocationName, null);

  await assert.rejects(
    mockCreatePost({ tripId: trip.id, visitedOn: today, locationId: location.id, customLocationName: 'Both', media }),
    isBadRequest(/at most one/),
  );
  await assert.rejects(
    mockCreatePost({ tripId: trip.id, visitedOn: today, rating: 4, media }),
    isBadRequest(/no location can't be rated/),
  );
  await assert.rejects(
    mockCreatePost({ tripId: trip.id, visitedOn: today, customLocationName: 'Home', rating: 4, media }),
    isBadRequest(/custom location name can't be rated/),
  );
});

test('mock: PATCH with both fields null removes the location and the rating', async () => {
  const today = todayLocalIso();
  const trip = await mockCreateTrip({ title: 'Remove it', destination: 'Lisbon, Portugal', startDate: today, endDate: today });
  const media = [{ s3Key: 'users/user_mock/posts/y.jpg', mediaType: 'image' }];
  const pin = await mockResolveLocation({ kind: 'pin', name: 'Secret beach', latitude: 38.68, longitude: -9.32 });
  const post = await mockCreatePost({ tripId: trip.id, visitedOn: today, locationId: pin.location.id, rating: 5, media });

  // A lone null is ambiguous
  await assert.rejects(mockUpdatePost(post.id, { locationId: null }), isBadRequest(/send both/));
  await assert.rejects(mockUpdatePost(post.id, { customLocationName: null }), isBadRequest(/send both/));
  // Can't keep a rating while removing the location
  await assert.rejects(
    mockUpdatePost(post.id, { locationId: null, customLocationName: null, rating: 5 }),
    isBadRequest(/no location can't be rated/),
  );

  const removed = await mockUpdatePost(post.id, { locationId: null, customLocationName: null });
  assert.equal(removed.location, null);
  assert.equal(removed.customLocationName, null);
  assert.equal(removed.rating, null);
  await assert.rejects(mockUpdatePost(post.id, { rating: 3 }), isBadRequest(/no location can't be rated/));

  // The pin went with it, like the API's trigger
  await assert.rejects(mockUpdatePost(post.id, { locationId: pin.location.id }), isBadRequest(/Location not found/));

  const named = await mockUpdatePost(post.id, { locationId: null, customLocationName: ' Home ' });
  assert.equal(named.customLocationName, 'Home');
});
