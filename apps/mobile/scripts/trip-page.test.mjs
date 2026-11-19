import test from 'node:test';
import assert from 'node:assert/strict';

import { dayPlaces, initialDay, tripShareContent } from '../src/lib/trip-page.ts';

const location = (id, name, extra = {}) => ({ id, name, address: null, city: null, ...extra });
// A URL ending in .mp4 is a video
const media = (url) => ({
  id: url,
  mediaType: url.endsWith('.mp4') ? 'video' : 'image',
  url,
  width: 1,
  height: 1,
  durationMs: null,
});
// `place` is a location, a custom name, or null for no location (#143 POST-4)
const post = (id, place, photos = []) => ({
  id,
  location: typeof place === 'object' ? place : null,
  customLocationName: typeof place === 'string' ? place : null,
  media: photos.map(media),
});

const belem = location('loc-belem', 'Torre de Belém', { city: 'Lisbon', address: 'Av. Brasília' });
const pasteis = location('loc-pasteis', 'Pastéis de Belém', { address: 'R. de Belém 84' });

test('dayPlaces lists each stop with a subtitle, cover and post count', () => {
  const places = dayPlaces([
    post('a', belem),
    post('b', belem, ['https://img/b1.jpg', 'https://img/b2.jpg']),
    post('c', pasteis),
    post('d', 'Tram 28'),
  ]);
  assert.deepEqual(places, [
    {
      key: 'loc-belem-0',
      name: 'Torre de Belém',
      subtitle: 'Lisbon',
      coverUrl: 'https://img/b1.jpg',
      coverSeed: 'b',
      postCount: 2,
    },
    {
      key: 'loc-pasteis-1',
      name: 'Pastéis de Belém',
      subtitle: 'R. de Belém 84',
      coverUrl: undefined,
      coverSeed: 'c',
      postCount: 1,
    },
    {
      key: 'custom:Tram 28-2',
      name: 'Tram 28',
      subtitle: null,
      coverUrl: undefined,
      coverSeed: 'd',
      postCount: 1,
    },
  ]);
  assert.deepEqual(dayPlaces([]), []);
});

test('dayPlaces leaves out posts with no location', () => {
  const places = dayPlaces([post('a', null), post('b', belem), post('c', null), post('d', 'Tram 28')]);
  assert.deepEqual(
    places.map((p) => [p.key, p.name]),
    [
      ['loc-belem-1', 'Torre de Belém'],
      ['custom:Tram 28-3', 'Tram 28'],
    ],
  );
  assert.deepEqual(dayPlaces([post('a', null)]), []);
});

test('dayPlaces covers a stop with its first photo, skipping videos', () => {
  const [onlyVideo, videoFirst] = dayPlaces([
    post('a', belem, ['https://img/a.mp4']),
    post('b', pasteis, ['https://img/b.mp4', 'https://img/b.jpg']),
    post('c', pasteis, ['https://img/c.jpg']),
  ]);
  assert.equal(onlyVideo.coverUrl, undefined);
  assert.equal(onlyVideo.coverSeed, 'a');
  assert.equal(videoFirst.coverUrl, 'https://img/b.jpg');
  assert.equal(videoFirst.coverSeed, 'b');
});

test('initialDay accepts only one of the trip’s days', () => {
  const days = ['2026-10-12', '2026-10-13', '2026-10-14'];
  assert.equal(initialDay('2026-10-13', days), '2026-10-13');
  assert.equal(initialDay('2026-10-20', days), null);
  assert.equal(initialDay('2', days), null);
  assert.equal(initialDay(undefined, days), null);
  assert.equal(initialDay(['2026-10-13'], days), null);
});

test('tripShareContent puts the link in the text once per platform', () => {
  const trip = { title: '5 Days in Lisbon', destination: 'Lisbon, Portugal' };
  const url = 'mobile://trips/t1';
  assert.deepEqual(tripShareContent(trip, url, 'ios'), {
    message: '5 Days in Lisbon · Lisbon, Portugal',
    url,
  });
  assert.deepEqual(tripShareContent(trip, url, 'android'), {
    message: '5 Days in Lisbon · Lisbon, Portugal\nmobile://trips/t1',
  });
});
