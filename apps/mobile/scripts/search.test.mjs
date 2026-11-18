import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
const { isSearchable, search } = await import('../src/api/search.ts');
const { followUser, unfollowUser } = await import('../src/api/profiles.ts');
const { setAuthTokenGetter } = await import('../src/lib/auth.ts');
const { isRefinement, normalizeSearchText } = await import('../src/utils/search-text.ts');

function withMode(mode, run) {
  const previous = process.env.EXPO_PUBLIC_API_MOCKS;
  process.env.EXPO_PUBLIC_API_MOCKS = mode;
  return Promise.resolve(run()).finally(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
    else process.env.EXPO_PUBLIC_API_MOCKS = previous;
  });
}

const mocked = (run) => withMode('all', run);

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

test('mock search returns nothing for queries under 2 characters', () =>
  mocked(async () => {
    assert.deepEqual(await search('people', 'm', null), { items: [], nextCursor: null });
    assert.deepEqual(await search('places', ' ', null), { items: [], nextCursor: null });
  }));

test('mock people search pages 20 at a time with a cursor', () =>
  mocked(async () => {
    const first = await search('people', 'traveler', null);
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, '20');
    const second = await search('people', 'traveler', first.nextCursor);
    assert.equal(second.nextCursor, null);
    const ids = [...first.items, ...second.items].map((person) => person.id);
    assert.equal(new Set(ids).size, ids.length);
  }));

test('mock people results carry follow state and counts, and follows change the next search', () =>
  mocked(async () => {
    const find = async (id) => (await search('people', 'nine_10', null)).items.find((person) => person.id === id);
    // You follow the first 16 mock travelers, so traveler 10 starts followed
    const before = await find('mock-traveler-10');
    assert.equal(before.isFollowing, true);
    assert.equal(typeof before.followerCount, 'number');

    await unfollowUser('mock-traveler-10');
    try {
      const after = await find('mock-traveler-10');
      assert.equal(after.isFollowing, false);
      assert.equal(after.followerCount, before.followerCount - 1);
    } finally {
      await followUser('mock-traveler-10');
    }
  }));

test('mock place search ignores accents and returns places with ratings', () =>
  mocked(async () => {
    const { items } = await search('places', 'sao jorge', null);
    assert.deepEqual(
      items.map((place) => place.id),
      ['castelo'],
    );
    const [castelo] = items;
    assert.equal(castelo.city, 'Lisbon');
    assert.equal(typeof castelo.latitude, 'number');
    assert.ok(castelo.rating && castelo.rating.count > 0 && castelo.rating.average > 0);

    for (const place of (await search('places', 'lisbon', null)).items) {
      assert.ok(place.rating === null || place.rating.count > 0);
    }
  }));

test('the real endpoint sends q, type, cursor and limit to GET /api/search', () =>
  withMode('none', async () => {
    const calls = [];
    const previousFetch = globalThis.fetch;
    setAuthTokenGetter(async () => null);
    globalThis.fetch = async (url, init) => {
      calls.push({ url: new URL(url), init });
      return new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    try {
      assert.deepEqual(await search('people', 'maya', 'abc'), { items: [], nextCursor: null });
      const { url, init } = calls[0];
      assert.equal(init.method, 'GET');
      assert.equal(url.origin + url.pathname, 'http://api.test/api/search');
      assert.deepEqual(Object.fromEntries(url.searchParams), { q: 'maya', type: 'people', cursor: 'abc', limit: '20' });

      // The first page leaves the cursor out
      await search('places', 'lisbon', null);
      assert.equal(calls[1].url.searchParams.has('cursor'), false);
      assert.equal(calls[1].url.searchParams.get('type'), 'places');
    } finally {
      globalThis.fetch = previousFetch;
    }
  }));
