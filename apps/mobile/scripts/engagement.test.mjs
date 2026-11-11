import test from 'node:test';
import assert from 'node:assert/strict';
import { createToggleSync } from '../src/lib/toggle-sync.ts';
import { containsTarget, updateEverywhere, uniqueById, withLike, withLikerFollowing, withSave } from '../src/lib/engagement-cache.ts';

// A fake server: each send waits until the test resolves it
function harness() {
  const sent = [];
  const shown = [];
  const settled = [];
  const failed = [];
  const pending = [];
  const sync = createToggleSync({
    send: (value) => {
      sent.push(value);
      return new Promise((resolve, reject) => pending.push({ value, resolve, reject }));
    },
    read: (result) => result.liked,
    show: (value) => shown.push(value),
    settle: (result) => settled.push(result),
    fail: (_error, confirmed) => failed.push(confirmed),
  });
  const next = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return pending.shift();
  };
  return { sync, sent, shown, settled, failed, next };
}

test('a tap shows at once and settles with the server result', async () => {
  const h = harness();
  h.sync.toggle(false);
  assert.deepEqual(h.shown, [true]);
  (await h.next()).resolve({ liked: true, likeCount: 5 });
  await h.next();
  assert.deepEqual(h.sent, [true]);
  assert.deepEqual(h.settled, [{ liked: true, likeCount: 5 }]);
});

test('tapping twice while a request is out sends one request, then undoes it', async () => {
  const h = harness();
  h.sync.toggle(false);
  h.sync.toggle(true);
  h.sync.toggle(false);
  h.sync.toggle(true);
  assert.deepEqual(h.shown, [true, false, true, false]);
  (await h.next()).resolve({ liked: true, likeCount: 1 });
  (await h.next()).resolve({ liked: false, likeCount: 0 });
  await h.next();
  assert.deepEqual(h.sent, [true, false]);
  assert.deepEqual(h.settled, [{ liked: false, likeCount: 0 }]);
});

test('a double tap that lands back on the sent value sends nothing more', async () => {
  const h = harness();
  h.sync.toggle(false);
  h.sync.toggle(true);
  h.sync.toggle(false);
  (await h.next()).resolve({ liked: true, likeCount: 1 });
  await h.next();
  assert.deepEqual(h.sent, [true]);
  assert.equal(h.settled.length, 1);
});

test('a failure goes back to the last value the server confirmed', async () => {
  const h = harness();
  h.sync.toggle(false);
  (await h.next()).reject(new TypeError('Network request failed'));
  await h.next();
  assert.deepEqual(h.failed, [false]);
  assert.equal(h.settled.length, 0);
  // and the next tap starts fresh
  h.sync.toggle(false);
  (await h.next()).resolve({ liked: true, likeCount: 1 });
  await h.next();
  assert.deepEqual(h.settled, [{ liked: true, likeCount: 1 }]);
});

test('a second tap before the screen re-renders still undoes the first', async () => {
  const h = harness();
  h.sync.toggle(false);
  h.sync.toggle(false); // same stale value from the last render
  assert.deepEqual(h.shown, [true, false]);
  (await h.next()).resolve({ liked: true, likeCount: 1 });
  (await h.next()).resolve({ liked: false, likeCount: 0 });
  await h.next();
  assert.deepEqual(h.sent, [true, false]);
  assert.deepEqual(h.settled, [{ liked: false, likeCount: 0 }]);
});

const post = { id: 'p1', likeCount: 2, saveCount: 0, likedByMe: false, savedByMe: false };
const trip = { id: 'p1', postCount: 3, saveCount: 1, savedByMe: true };

test('withLike moves the count by one, or takes the server count', () => {
  assert.deepEqual(withLike(post, true), { ...post, likedByMe: true, likeCount: 3 });
  assert.equal(withLike(post, false), post);
  assert.deepEqual(withLike(post, true, 9), { ...post, likedByMe: true, likeCount: 9 });
  assert.equal(withLike({ ...post, likeCount: 0, likedByMe: true }, false).likeCount, 0);
  assert.deepEqual(withSave(trip, false), { ...trip, savedByMe: false, saveCount: 0 });
});

test('updateEverywhere reaches posts in infinite lists and leaves other data alone', () => {
  const other = { id: 'p2', likeCount: 1 };
  const data = { pages: [{ items: [post, other], nextCursor: null }], pageParams: [null] };
  const next = updateEverywhere(data, 'post', 'p1', (item) => withLike(item, true));
  assert.equal(next.pages[0].items[0].likedByMe, true);
  assert.equal(next.pages[0].items[1], other);
  assert.equal(next.pageParams, data.pageParams);
  assert.equal(updateEverywhere(data, 'post', 'nope', () => ({})), data);
});

test('a trip and a post with the same id are told apart', () => {
  assert.equal(containsTarget({ items: [trip] }, 'post', 'p1'), false);
  assert.equal(containsTarget({ items: [trip] }, 'trip', 'p1'), true);
  assert.equal(containsTarget(undefined, 'post', 'p1'), false);
});

test('withLikerFollowing updates one person on a likes list', () => {
  const liker = { id: 'u1', username: 'maya', isFollowing: false, likedAt: '2026-10-01T00:00:00Z' };
  const data = { pages: [{ items: [liker], nextCursor: null }] };
  assert.equal(withLikerFollowing(data, 'u1', true).pages[0].items[0].isFollowing, true);
  assert.equal(withLikerFollowing(data, 'u1', false), data);
});

test('uniqueById keeps the first of each id', () => {
  assert.deepEqual(uniqueById([{ id: 'a', n: 1 }, { id: 'b' }, { id: 'a', n: 2 }]), [{ id: 'a', n: 1 }, { id: 'b' }]);
});
