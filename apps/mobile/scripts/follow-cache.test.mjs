import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adjustCount,
  setFollowingInPages,
  setFollowingInPreview,
  setFollowingInSearch,
  uniqueById,
} from '../src/lib/follow-cache.ts';

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

test('setFollowingInSearch flips the matching person and moves their follower count once', () => {
  const a = { id: 'a', isFollowing: false, followerCount: 3, followingCount: 0 };
  const b = { id: 'b', isFollowing: false, followerCount: 1, followingCount: 0 };
  const data = {
    pageParams: [null, '1'],
    pages: [
      { items: [a, b], nextCursor: '1' },
      { items: [a], nextCursor: null },
    ],
  };
  const followed = setFollowingInSearch(data, 'a', true);
  const followedA = { ...a, isFollowing: true, followerCount: 4 };
  assert.deepEqual(followed.pages[0].items[0], followedA);
  assert.deepEqual(followed.pages[1].items[0], followedA);
  assert.equal(followed.pages[0].items[1], b);
  assert.equal(data.pages[0].items[0].isFollowing, false);
  // Already followed: nothing changes
  assert.equal(setFollowingInSearch(followed, 'a', true).pages[0].items[0].followerCount, 4);
  assert.deepEqual(setFollowingInSearch(followed, 'a', false).pages[0].items[0], a);
  assert.equal(setFollowingInSearch(undefined, 'a', true), undefined);
});

test('uniqueById keeps the first of each id in order', () => {
  assert.deepEqual(uniqueById([{ id: 'a', n: 1 }, { id: 'b' }, { id: 'a', n: 2 }]), [{ id: 'a', n: 1 }, { id: 'b' }]);
});

test('setFollowingInPreview flips the person in the "All" preview and leaves other sections alone', () => {
  const a = { id: 'a', isFollowing: false, followerCount: 3, followingCount: 0 };
  const preview = { people: [a], places: [{ id: 'p' }], trips: [], posts: [] };
  const next = setFollowingInPreview(preview, 'a', true);
  assert.deepEqual(next.people[0], { ...a, isFollowing: true, followerCount: 4 });
  assert.equal(next.places, preview.places);
  assert.equal(setFollowingInPreview(next, 'a', true).people[0].followerCount, 4);
  assert.equal(setFollowingInPreview(undefined, 'a', true), undefined);
});
