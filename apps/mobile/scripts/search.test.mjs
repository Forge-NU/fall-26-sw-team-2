import assert from 'node:assert/strict';
import test from 'node:test';

import { isSearchable, search } from '../src/api/search.ts';
import { setAuthTokenGetter } from '../src/lib/auth.ts';
import { isRefinement, normalizeSearchText } from '../src/utils/search-text.ts';
import { createSearchFixtures } from '../src/api/search-fixtures.ts';
import { createSearchMock } from '../src/api/search-mock.ts';
import { activeFilterCount, buildSearchRequest, defaultSearchFilters, filterError } from '../src/lib/search/filters.ts';

const centers = { permission: 'granted', nearMe: { latitude: 38.707, longitude: -9.136 }, mapCenter: { latitude: 38.77, longitude: -9.1 } };

test('filter selections survive type changes, but only applicable filters are counted and sent', () => {
  const filters = { ...defaultSearchFilters(), from: '2026-06-01', to: '2026-06-30', minRating: 4, radiusKm: 10, sort: 'newest' };
  assert.equal(activeFilterCount(filters, 'all'), 4);
  assert.equal(activeFilterCount(filters, 'people'), 1);
  assert.equal(activeFilterCount(filters, 'places'), 3);
  assert.deepEqual(buildSearchRequest('  Maya\t Chen  ', 'people', filters, centers), { q: 'Maya Chen', type: 'people', sort: 'newest' });
  assert.deepEqual(buildSearchRequest('Lisbon', 'posts', filters, centers), {
    q: 'Lisbon', type: 'posts', sort: 'newest', from: '2026-06-01', to: '2026-06-30', minRating: 4, radiusKm: 10, lat: 38.77, lng: -9.1,
  });
  assert.equal(filters.minRating, 4);
  assert.equal(activeFilterCount(defaultSearchFilters(), 'all'), 0);
});

test('invalid dates and unavailable centers cannot silently produce an unfiltered request', () => {
  assert.match(filterError({ ...defaultSearchFilters(), from: '2026-02-30' }, 'posts', centers), /valid dates/);
  assert.match(filterError({ ...defaultSearchFilters(), from: '2026-06-30', to: '2026-06-01' }, 'trips', centers), /End date/);
  const filters = { ...defaultSearchFilters(), radiusKm: 10, distanceSource: 'nearMe' };
  const denied = { ...centers, permission: 'denied' };
  assert.throws(() => buildSearchRequest('Lisbon', 'posts', filters, denied), /Location access is off/);
  assert.equal(filterError(filters, 'people', denied), null);
  assert.equal(filterError({ ...filters, distanceSource: 'mapCenter' }, 'posts', denied), null);
  assert.match(filterError(filters, 'posts', { ...centers, nearMe: null }), /not available/);
  assert.match(filterError({ ...filters, distanceSource: 'mapCenter' }, 'posts', { ...centers, mapCenter: null }), /map first/);
});

test('mock preview caps all four sections and single-type pages have no repeats', async () => {
  const mock = createSearchMock(undefined, 0);
  const preview = await mock({ q: 'Lisbon' });
  for (const type of ['people', 'places', 'trips', 'posts']) {
    assert.equal(preview[type].length, 3);
    const ids = [];
    let cursor;
    do {
      const result = await mock({ q: 'Lisbon', type, cursor, limit: 7 });
      ids.push(...result.items.map(item => item.id));
      cursor = result.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 36);
    assert.equal(new Set(ids).size, 36);
  }
  const empty = await mock({ q: '' });
  assert.ok(Object.values(empty).every(items => items.length === 0));
});

test('mock combines date, place-average rating and radius like SRCH-3', async () => {
  const data = createSearchFixtures();
  const mock = createSearchMock(data, 0);
  const request = { q: 'Lisbon', type: 'posts', from: '2026-06-01', to: '2026-06-30', minRating: 4, lat: 38.707, lng: -9.136, radiusKm: 10 };
  const filtered = await mock(request);
  assert.ok(filtered.items.length > 0 && filtered.items.length < 18);
  for (const post of filtered.items) {
    assert.ok(post.visitedOn.startsWith('2026-06'));
    assert.ok(data.places.find(place => place.id === post.location.id).rating.average >= 4);
  }
  const nearby = await mock({ ...request, radiusKm: 1 });
  assert.equal(nearby.items.length, 2);
  assert.ok(nearby.items.length < filtered.items.length);
  assert.ok(nearby.items.every(post => post.location.latitude === 38.707 && post.location.longitude === -9.136));
  assert.ok((await mock({ ...request, minRating: 3, radiusKm: 50 })).items.length > filtered.items.length);
  assert.equal((await mock({ q: 'Lisbon', type: 'trips', from: '2026-06-14', to: '2026-06-14', limit: 50 })).items.length, 18);
  assert.equal((await mock({ q: 'Lisbon', type: 'trips', from: '2026-06-15', to: '2026-06-15' })).items.length, 0);
});

test('mock excludes private posts/trips and filters using place averages rather than per-post stars', async () => {
  const data = createSearchFixtures();
  data.trips[0].status = 'draft';
  data.places[1].rating = { average: 4.5, count: 2 };
  const mock = createSearchMock(data, 0);
  const posts = await mock({ q: 'Lisbon', type: 'posts', minRating: 4.5, limit: 50 });
  assert.ok(posts.items.some(post => post.id === data.posts[1].id));
  assert.ok(!posts.items.some(post => post.id === data.posts[0].id));
  assert.ok(!(await mock({ q: 'Lisbon', type: 'trips', limit: 50 })).items.some(trip => trip.id === data.trips[0].id));
});

test('mock sort changes order and rejects cursors from a different filter or type', async () => {
  const mock = createSearchMock(undefined, 0);
  const first = await mock({ q: 'Lisbon', type: 'posts', limit: 3 });
  const newest = await mock({ q: 'Lisbon', type: 'posts', sort: 'newest', limit: 3 });
  assert.notDeepEqual(first.items.map(item => item.id), newest.items.map(item => item.id));
  await assert.rejects(mock({ q: 'Lisbon', type: 'posts', minRating: 4, cursor: first.nextCursor }), /cursor/);
  await assert.rejects(mock({ q: 'Lisbon', type: 'people', cursor: first.nextCursor }), /cursor/);
});

test('mock and real requests both support AbortSignal', async () => {
  const controller = new AbortController();
  const pending = createSearchMock(undefined, 1000)({ q: 'Lisbon' }, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(createSearchMock(undefined, 0)({ q: 'Lisbon' }, controller.signal), { name: 'AbortError' });
  const previousMode = process.env.EXPO_PUBLIC_API_MOCKS;
  const originalFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_MOCKS = 'none';
  globalThis.fetch = async (url, options) => {
    assert.equal(options.signal, controller.signal);
    assert.match(String(url), /\/api\/search\?q=Lisbon/);
    throw new DOMException('Aborted', 'AbortError');
  };
  try { await assert.rejects(search({ q: 'Lisbon' }, controller.signal), { name: 'AbortError' }); }
  finally {
    globalThis.fetch = originalFetch;
    if (previousMode === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
    else process.env.EXPO_PUBLIC_API_MOCKS = previousMode;
  }
});

test('mock matches the live flat-coordinate and discriminator-free page contract', async () => {
  const mock = createSearchMock(undefined, 0);
  const result = await mock({ q: 'Lisbon', type: 'places', limit: 1 });
  assert.equal('type' in result, false);
  assert.equal(typeof result.items[0].latitude, 'number');
  assert.equal(typeof result.items[0].longitude, 'number');
  assert.equal('coordinate' in result.items[0], false);
});

test('search follows share mock state with profiles', async () => {
  const { followUser, unfollowUser, getFollowStatus } = await import('../src/api/profiles.ts');
  const previousMode = process.env.EXPO_PUBLIC_API_MOCKS;
  process.env.EXPO_PUBLIC_API_MOCKS = 'all';
  try {
    const before = await search({ q: 'maya', type: 'people' });
    const person = before.items[0];
    assert.ok(person);
    if (person.isFollowing) await unfollowUser(person.id);
    else await followUser(person.id);
    try {
      assert.equal((await getFollowStatus(person.id)).isFollowing, !person.isFollowing);
      const after = await search({ q: 'maya', type: 'people' });
      assert.equal(after.items.find(item => item.id === person.id).isFollowing, !person.isFollowing);
    } finally {
      if (person.isFollowing) await followUser(person.id);
      else await unfollowUser(person.id);
    }
  } finally {
    if (previousMode === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
    else process.env.EXPO_PUBLIC_API_MOCKS = previousMode;
  }
});

test('normalizeSearchText ignores accents, case and outer spaces', () => {
  assert.equal(normalizeSearchText('  Castelo de São Jorge '), 'castelo de sao jorge');
  assert.equal(normalizeSearchText('Sensō-ji'), 'senso-ji');
  // Already-decomposed text: "e" followed by a combining acute accent
  assert.equal(normalizeSearchText(`Caf${'e'}${String.fromCharCode(0x301)}`), 'cafe');
});

test('isRefinement is true only while typing or deleting within the same query', () => {
  assert.equal(isRefinement('lis', 'lisbon'), true);
  assert.equal(isRefinement('Lisbon', 'lisbo'), true);
  assert.equal(isRefinement('joao', 'João'), true);
  assert.equal(isRefinement('maya', 'lisbon'), false);
  assert.equal(isRefinement('maya', 'may a'), false);
  assert.equal(isRefinement(undefined, 'lisbon'), false);
});

test('isSearchable needs 2 characters after trimming, counting characters not UTF-16 units', () => {
  assert.equal(isSearchable(''), false);
  assert.equal(isSearchable(' m  '), false);
  assert.equal(isSearchable('é'), false);
  // One emoji is two UTF-16 units but one character
  assert.equal(isSearchable(String.fromCodePoint(0x1f30d)), false);
  assert.equal(isSearchable('ma'), true);
});

test('the real endpoint sends the request as query params to GET /api/search', async () => {
  const previousMode = process.env.EXPO_PUBLIC_API_MOCKS;
  const previousFetch = globalThis.fetch;
  process.env.EXPO_PUBLIC_API_MOCKS = 'none';
  setAuthTokenGetter(async () => null);
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify({ items: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await search({ q: 'maya', type: 'people', sort: 'relevance', cursor: 'abc' }), {
      items: [],
      nextCursor: null,
    });
    const { url, init } = calls[0];
    assert.equal(init.method, 'GET');
    assert.equal(url.pathname, '/api/search');
    assert.deepEqual(Object.fromEntries(url.searchParams), { q: 'maya', type: 'people', sort: 'relevance', cursor: 'abc' });

    // The first page and the "All" preview leave out what isn't set
    await search({ q: 'lisbon', sort: 'newest', cursor: undefined });
    assert.deepEqual(Object.fromEntries(calls[1].url.searchParams), { q: 'lisbon', sort: 'newest' });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMode === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
    else process.env.EXPO_PUBLIC_API_MOCKS = previousMode;
  }
});
