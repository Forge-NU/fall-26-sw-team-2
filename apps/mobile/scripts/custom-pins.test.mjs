// Dropped pins (#94 LOC-2): what the picker hands to posts and stories, where
// the pin map starts, and the mock resolve behind EXPO_PUBLIC_API_MOCKS=all.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/api/client.ts';
import { mockCreatePost, mockCreateStory, mockCreateTrip, mockGeocodePlace, mockResolveLocation } from '../src/api/mock-backend.ts';
import {
  isCustomNameTooLong,
  isExpiredPinError,
  locationName,
  locationSubtitle,
  toLocationFields,
} from '../src/lib/picked-location.ts';
import { choosePinStart, latestPostPoint, parsePoint, roundPoint, WORLD_CENTER } from '../src/lib/pin-start.ts';
import { todayLocalIso } from '../src/utils/local-date.ts';

const place = (overrides = {}) => ({
  id: 'loc-1',
  provider: 'mapbox',
  providerPlaceId: 'mapbox.1',
  name: 'Pena Palace',
  address: null,
  latitude: 38.787586,
  longitude: -9.390616,
  city: 'Sintra',
  region: 'Lisbon',
  countryCode: 'PT',
  rating: null,
  ...overrides,
});

const mapbox = { kind: 'mapbox', location: place() };
const pin = {
  kind: 'pin',
  location: place({ id: 'pin-1', provider: 'custom', providerPlaceId: 'gen', name: 'Secret beach', city: null, region: null, countryCode: null }),
};
const custom = { kind: 'custom', name: "Tia Rosa's kitchen" };

test('a pin goes on a post or story by locationId, like a Mapbox place', () => {
  assert.deepEqual(toLocationFields(mapbox), { locationId: 'loc-1' });
  assert.deepEqual(toLocationFields(pin), { locationId: 'pin-1' });
  assert.deepEqual(toLocationFields(custom), { customLocationName: "Tia Rosa's kitchen" });
});

test('the picker field shows the pin name and says it is a dropped pin', () => {
  assert.equal(locationName(pin), 'Secret beach');
  assert.equal(locationName(custom), "Tia Rosa's kitchen");
  assert.equal(locationSubtitle(pin), 'Dropped pin');
  assert.equal(locationSubtitle(custom), 'Custom location');
  assert.equal(locationSubtitle(mapbox), 'Sintra, PT');
  assert.equal(locationSubtitle({ kind: 'mapbox', location: place({ city: null, countryCode: null }) }), null);
});

test('names over 100 code points are too long for a pin or a custom name', () => {
  assert.equal(isCustomNameTooLong('a'.repeat(100)), false);
  assert.equal(isCustomNameTooLong('a'.repeat(101)), true);
  // '❤️' is two code points, the way Postgres counts it
  assert.equal(isCustomNameTooLong('❤️'.repeat(51)), true);
});

test('only a pin that was cleaned up gets dropped again on retry', () => {
  assert.equal(isExpiredPinError(pin, 400, 'Location not found'), true);
  assert.equal(isExpiredPinError(mapbox, 400, 'Location not found'), false);
  assert.equal(isExpiredPinError(pin, 400, 'This pin is already on another post or story.'), false);
  assert.equal(isExpiredPinError(pin, 500, 'Location not found'), false);
});

const lisbonTrip = { id: 'trip-1', destination: 'Lisbon, Portugal' };
const here = { latitude: 41.1, longitude: -8.6 };
const lisbon = { latitude: 38.72, longitude: -9.14 };
const post = (visitedOn, createdAt, location) => ({ visitedOn, createdAt, location });

function sources(overrides = {}) {
  const calls = [];
  return {
    calls,
    devicePosition: async () => {
      calls.push('device');
      return null;
    },
    geocode: async (text) => {
      calls.push(`geocode:${text}`);
      return null;
    },
    tripPosts: async (id) => {
      calls.push(`posts:${id}`);
      return [];
    },
    ...overrides,
  };
}

test('with location permission, the pin map starts where the user is', async () => {
  const s = sources({ devicePosition: async () => here });
  const start = await choosePinStart(lisbonTrip, s);
  assert.equal(start.source, 'device');
  assert.deepEqual(start.center, here);
  assert.deepEqual(s.calls, []);
});

test('without permission it starts at the trip destination', async () => {
  const s = sources({ geocode: async () => lisbon });
  const start = await choosePinStart(lisbonTrip, s);
  assert.equal(start.source, 'destination');
  assert.deepEqual(start.center, lisbon);
});

test('then at the latest trip post that has a place', async () => {
  const s = sources({
    geocode: async () => {
      throw new Error('offline');
    },
    tripPosts: async () => [
      post('2026-10-03', '2026-10-03T10:00:00Z', place({ latitude: 1, longitude: 1 })),
      post('2026-10-05', '2026-10-05T09:00:00Z', place({ latitude: 2, longitude: 2 })),
      post('2026-10-05', '2026-10-05T11:00:00Z', place({ latitude: 3, longitude: 3 })),
      // Latest, but only a custom name
      post('2026-10-06', '2026-10-06T09:00:00Z', null),
    ],
  });
  const start = await choosePinStart(lisbonTrip, s);
  assert.equal(start.source, 'trip-post');
  assert.deepEqual(start.center, { latitude: 3, longitude: 3 });
});

test('then the whole world, and a story without a trip goes straight there', async () => {
  const s = sources({
    devicePosition: async () => {
      throw new Error('Location Services off');
    },
    tripPosts: async () => {
      throw new Error('offline');
    },
  });
  const start = await choosePinStart(lisbonTrip, s);
  assert.equal(start.source, 'world');
  assert.deepEqual(start.center, WORLD_CENTER);
  assert.ok(start.latitudeDelta > 90);

  const noTrip = sources();
  assert.equal((await choosePinStart(null, noTrip)).source, 'world');
  assert.deepEqual(noTrip.calls, ['device']);
});

test('a blank destination skips the geocode', async () => {
  const s = sources();
  await choosePinStart({ id: 'trip-2', destination: '  ' }, s);
  assert.deepEqual(s.calls, ['device', 'posts:trip-2']);
});

test('latestPostPoint is null when no post has a place', () => {
  assert.equal(latestPostPoint([]), null);
  assert.equal(latestPostPoint([post('2026-10-03', '2026-10-03T10:00:00Z', null)]), null);
});

test('typed coordinates must be a real point', () => {
  assert.deepEqual(parsePoint('38.7', '-9.14'), { latitude: 38.7, longitude: -9.14 });
  assert.equal(parsePoint('', '-9.14'), null);
  assert.equal(parsePoint('91', '0'), null);
  assert.equal(parsePoint('0', '-181'), null);
  assert.equal(parsePoint('abc', '0'), null);
  assert.deepEqual(roundPoint({ latitude: 38.12345678, longitude: -9.98765449 }), {
    latitude: 38.123457,
    longitude: -9.987654,
  });
});

test('mock: two identical pins make two rows, and each goes on one post or story', async () => {
  const body = { kind: 'pin', name: '  Secret beach ', latitude: 38.68, longitude: -9.32 };
  const first = await mockResolveLocation(body);
  const second = await mockResolveLocation(body);
  assert.equal(first.kind, 'pin');
  assert.equal(first.location.provider, 'custom');
  assert.equal(first.location.name, 'Secret beach');
  assert.notEqual(first.location.id, second.location.id);

  const today = todayLocalIso();
  const trip = await mockCreateTrip({ title: 'Pins', destination: 'Lisbon, Portugal', startDate: today, endDate: today });
  const media = [{ s3Key: 'users/user_mock/posts/a.jpg', mediaType: 'image' }];
  const created = await mockCreatePost({ tripId: trip.id, visitedOn: today, locationId: first.location.id, rating: 5, media });
  assert.equal(created.location.id, first.location.id);
  assert.equal(created.rating, 5);

  await assert.rejects(
    mockCreatePost({ tripId: trip.id, visitedOn: today, locationId: first.location.id, media }),
    (error) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    mockCreateStory({ s3Key: 'users/user_mock/stories/b.jpg', locationId: first.location.id }),
    (error) => error instanceof ApiError && error.status === 400,
  );
  const story = await mockCreateStory({ s3Key: 'users/user_mock/stories/c.jpg', locationId: second.location.id });
  assert.equal(story.location.id, second.location.id);
});

test('mock: a pin name follows the custom name rule', async () => {
  await assert.rejects(mockResolveLocation({ kind: 'pin', name: ' ', latitude: 0, longitude: 0 }), ApiError);
  await assert.rejects(mockResolveLocation({ kind: 'pin', name: 'a'.repeat(101), latitude: 0, longitude: 0 }), ApiError);
});

test('mock: a destination geocodes to the mock place named in it', async () => {
  assert.deepEqual(await mockGeocodePlace('Lisbon, Portugal'), { latitude: 38.722252, longitude: -9.139337 });
  assert.equal(await mockGeocodePlace('Kyoto, Japan'), null);
});
