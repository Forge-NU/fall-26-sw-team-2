import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dayPlaces,
  groupByPlace,
  initialDay,
  postPlaceName,
  tripShareContent,
} from '../src/lib/trip-page.ts';

const location = (id, name, extra = {}) => ({ id, name, address: null, city: null, ...extra });
const media = (url) => ({ id: url, mediaType: 'image', url, width: 1, height: 1, durationMs: null });
const post = (id, place, photos = []) => ({
  id,
  location: typeof place === 'string' ? null : place,
  customLocationName: typeof place === 'string' ? place : null,
  media: photos.map(media),
});

const belem = location('loc-belem', 'Torre de Belém', { city: 'Lisbon', address: 'Av. Brasília' });
const pasteis = location('loc-pasteis', 'Pastéis de Belém', { address: 'R. de Belém 84' });

test('postPlaceName uses the location, then the custom name', () => {
  assert.equal(postPlaceName(post('a', belem)), 'Torre de Belém');
  assert.equal(postPlaceName(post('b', 'Aunt’s flat')), 'Aunt’s flat');
  assert.equal(postPlaceName({ location: null, customLocationName: null }), 'Unknown place');
});

test('groupByPlace groups back-to-back posts and keeps visit order', () => {
  const posts = [post('a', belem), post('b', belem), post('c', 'Tram 28'), post('d', belem)];
  assert.deepEqual(
    groupByPlace(posts).map((g) => [g.name, g.posts.map((p) => p.id)]),
    [
      ['Torre de Belém', ['a', 'b']],
      ['Tram 28', ['c']],
      ['Torre de Belém', ['d']],
    ],
  );
});

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
