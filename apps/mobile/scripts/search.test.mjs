import assert from 'node:assert/strict';
import test from 'node:test';

import { search } from '../src/api/search.ts';
import { createSearchFixtures } from '../src/api/search-fixtures.ts';
import { createSearchMock } from '../src/api/search-mock.ts';
import { activeFilterCount, buildSearchRequest, defaultSearchFilters, filterError } from '../src/lib/search/filters.ts';
import { createSearchSession } from '../src/lib/search/session.ts';

const centers = { permission: 'granted', nearMe: { latitude: 38.707, longitude: -9.136 }, mapCenter: { latitude: 38.77, longitude: -9.1 } };
const wait = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const person = id => ({ id, username: id, firstName: id, lastName: '', avatarUrl: null, isFollowing: false });
const page = (ids, nextCursor = null) => ({ items: ids.map(person), nextCursor });

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

test('debounce skips short input and cancels work as soon as text or filters change', async () => {
  const calls = [];
  const session = createSearchSession(async (request, signal) => {
    calls.push({ request, signal });
    return page([request.q]);
  }, 15);
  session.setRequest({ q: 'x', type: 'people' });
  await wait(20);
  assert.equal(calls.length, 0);
  session.setRequest({ q: 'Ma', type: 'people' });
  session.setRequest({ q: 'Maya', type: 'people' });
  await wait(20);
  assert.equal(calls.length, 1);
  session.setRequest({ q: 'Maya', type: 'people', sort: 'newest' });
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(session.getSnapshot().page, null);
  await wait(20);
  assert.equal(calls[1].request.sort, 'newest');
  session.reset();
});

test('late responses from an abort-ignoring transport cannot overwrite newer results or reset', async () => {
  const pending = [];
  const session = createSearchSession((request, signal) => new Promise(resolve => pending.push({ request, signal, resolve })), 0);
  session.setRequest({ q: 'Maya', type: 'people' });
  await wait();
  session.setRequest({ q: 'Alex', type: 'people' });
  assert.equal(pending[0].signal.aborted, true);
  await wait();
  pending[1].resolve(page(['alex']));
  await wait();
  pending[0].resolve(page(['maya']));
  await wait();
  assert.equal(session.getSnapshot().page.items[0].id, 'alex');
  session.setRequest({ q: 'Priya', type: 'people' });
  await wait();
  session.reset();
  pending[2].resolve(page(['priya']));
  await wait();
  assert.equal(session.getSnapshot().status, 'idle');
  assert.equal(session.getSnapshot().page, null);
});

test('pagination deduplicates, guards repeated scroll events, and retries failed pages explicitly', async () => {
  let calls = 0;
  let fail = true;
  const session = createSearchSession(async (request) => {
    calls++;
    if (!request.cursor) return page(['a', 'b'], 'next');
    await wait();
    if (fail) throw new Error('Offline');
    return page(['b', 'c']);
  }, 0);
  session.setRequest({ q: 'Lisbon', type: 'people' });
  await wait();
  await Promise.all([session.loadMore(), session.loadMore()]);
  assert.equal(calls, 2);
  assert.match(session.getSnapshot().pageError.message, /Offline/);
  await session.loadMore();
  assert.equal(calls, 2);
  fail = false;
  session.retry();
  await wait(20);
  assert.deepEqual(session.getSnapshot().page.items.map(item => item.id), ['a', 'b', 'c']);
  assert.equal(session.getSnapshot().page.nextCursor, null);
  assert.equal(session.getSnapshot().pageError, null);
  session.reset();
});

test('changing type aborts a pending next page; initial errors can be retried', async () => {
  let resolvePage;
  let signal;
  let fail = true;
  const session = createSearchSession(async (request, abortSignal) => {
    if (fail) throw new Error('Offline');
    if (!request.cursor) return page(['a'], 'next');
    signal = abortSignal;
    return new Promise(resolve => { resolvePage = resolve; });
  }, 0);
  session.setRequest({ q: 'Maya', type: 'people' });
  await wait();
  assert.equal(session.getSnapshot().status, 'error');
  fail = false;
  session.retry();
  await wait();
  const more = session.loadMore();
  session.setRequest(null);
  assert.equal(signal.aborted, true);
  resolvePage(page(['b']));
  await more;
  assert.equal(session.getSnapshot().page, null);
});

test('mock matches the live flat-coordinate and discriminator-free page contract', async () => {
  const mock = createSearchMock(undefined, 0);
  const result = await mock({ q: 'Lisbon', type: 'places', limit: 1 });
  assert.equal('type' in result, false);
  assert.equal(typeof result.items[0].latitude, 'number');
  assert.equal(typeof result.items[0].longitude, 'number');
  assert.equal('coordinate' in result.items[0], false);
  const session = createSearchSession(mock, 0);
  session.setRequest({ q: 'Lisbon', type: 'places' });
  await wait(20);
  assert.equal(session.getSnapshot().status, 'ready');
  assert.ok(session.getSnapshot().page.items.length > 0);
  session.reset();
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
