import test from 'node:test';
import assert from 'node:assert/strict';

import { adjustCount, setFollowingInPages, uniqueById } from '../src/lib/follow-cache.ts';

const profile = { id: 'a', followerCount: 1, followingCount: 0 };

test('adjustCount changes one count and never goes below zero', () => {
  assert.deepEqual(adjustCount(profile, 'followerCount', 1), { ...profile, followerCount: 2 });
  assert.equal(adjustCount(profile, 'followingCount', -1).followingCount, 0);
  assert.equal(adjustCount(undefined, 'followerCount', 1), undefined);
});

test('setFollowingInPages flips only the matching user on every page', () => {
  const data = {
    pageParams: [null, '1'],
    pages: [
      { items: [{ id: 'a', isFollowing: false }, { id: 'b', isFollowing: false }], nextCursor: '1' },
      { items: [{ id: 'a', isFollowing: false }], nextCursor: null },
    ],
  };
  const next = setFollowingInPages(data, 'a', true);
  assert.deepEqual(next.pages.map((p) => p.items.map((u) => u.isFollowing)), [[true, false], [true]]);
  assert.equal(data.pages[0].items[0].isFollowing, false);
});

test('uniqueById keeps the first of each id in order', () => {
  assert.deepEqual(uniqueById([{ id: 'a', n: 1 }, { id: 'b' }, { id: 'a', n: 2 }]), [{ id: 'a', n: 1 }, { id: 'b' }]);
});
