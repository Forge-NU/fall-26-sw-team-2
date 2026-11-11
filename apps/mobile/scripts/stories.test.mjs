import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeGroups,
  flattenGroups,
  ownGroupFirst,
  stepStory,
  storyAfterLeaving,
  storyAge,
  storyOwnerName,
  storyPlaceName,
  storiesOnDay,
  withoutStory,
} from '../src/lib/stories.ts';

const now = Date.parse('2026-11-11T12:00:00Z');
const later = '2026-11-12T00:00:00Z';
const earlier = '2026-11-11T11:00:00Z';

const user = (id) => ({ id, firstName: id, lastName: '', username: id, avatarUrl: null });
const story = (id, ownerId, expiresAt = later) => ({ id, owner: user(ownerId), expiresAt });
const groups = [
  { owner: user('maya'), stories: [story('m1', 'maya'), story('m2', 'maya')] },
  { owner: user('me'), stories: [story('a1', 'me')] },
  { owner: user('priya'), stories: [story('p1', 'priya')] },
];

test('activeGroups drops expired stories and users left with none', () => {
  const result = activeGroups(
    [
      { owner: user('maya'), stories: [story('m1', 'maya', earlier), story('m2', 'maya')] },
      { owner: user('priya'), stories: [story('p1', 'priya', earlier)] },
    ],
    now,
  );
  assert.deepEqual(result.map((g) => g.stories.map((s) => s.id)), [['m2']]);
});

test("ownGroupFirst moves the viewer's stories to the front and keeps the rest in order", () => {
  assert.deepEqual(ownGroupFirst(groups, 'me').map((g) => g.owner.id), ['me', 'maya', 'priya']);
  assert.deepEqual(ownGroupFirst(groups, 'nobody').map((g) => g.owner.id), ['maya', 'me', 'priya']);
});

test('withoutStory removes one story, and the user once it was their last', () => {
  assert.deepEqual(withoutStory(groups, 'm1')[0].stories.map((s) => s.id), ['m2']);
  assert.deepEqual(withoutStory(groups, 'a1').map((g) => g.owner.id), ['maya', 'priya']);
});

test("stepStory crosses into the next user's stories and stops at either end", () => {
  const all = flattenGroups(groups);
  assert.equal(stepStory(all, 'm2', 1).id, 'a1');
  assert.equal(stepStory(all, 'a1', -1).id, 'm2');
  assert.equal(stepStory(all, 'p1', 1), null);
  assert.equal(stepStory(all, 'm1', -1), null);
  assert.equal(stepStory(all, 'gone', 1), null);
});

test('storyAfterLeaving goes on to the next story still there', () => {
  const all = flattenGroups(groups);
  const without = (...ids) => all.filter((s) => !ids.includes(s.id));
  // Deleted or expired in the middle: the next one
  assert.equal(storyAfterLeaving(all, without('m2'), 'm2', false).id, 'a1');
  // The next one expired too: skips it
  assert.equal(storyAfterLeaving(all, without('m2', 'a1'), 'm2', false).id, 'p1');
  // The last story expired: closes
  assert.equal(storyAfterLeaving(all, without('p1'), 'p1', false), null);
  // The last story deleted: back to the one before it
  assert.equal(storyAfterLeaving(all, without('p1'), 'p1', true).id, 'a1');
  // The only story deleted: closes
  assert.equal(storyAfterLeaving([story('x', 'me')], [], 'x', true), null);
});

test('storyPlaceName prefers the Mapbox place, then the typed-in name', () => {
  assert.equal(storyPlaceName({ location: { name: 'Pena Palace' }, customLocationName: null }), 'Pena Palace');
  assert.equal(storyPlaceName({ location: null, customLocationName: 'Tram 28' }), 'Tram 28');
  assert.equal(storyPlaceName({ location: null, customLocationName: null }), null);
});

test('storyOwnerName falls back to the username', () => {
  assert.equal(storyOwnerName({ firstName: 'Maya', lastName: 'Chen', username: 'maya' }), 'Maya Chen');
  assert.equal(storyOwnerName({ firstName: '', lastName: '', username: 'maya' }), 'maya');
});

test('storyAge rounds down to minutes, hours, then days', () => {
  assert.equal(storyAge(new Date(now - 30_000).toISOString(), now), 'now');
  assert.equal(storyAge(new Date(now - 12 * 60_000).toISOString(), now), '12m');
  assert.equal(storyAge(new Date(now - 5 * 3_600_000).toISOString(), now), '5h');
  assert.equal(storyAge(new Date(now - 30 * 3_600_000).toISOString(), now), '1d');
});

test("storiesOnDay keeps one day's stories in their order", () => {
  const kept = [
    { id: 'a', storyDate: '2026-11-09' },
    { id: 'b', storyDate: '2026-11-10' },
    { id: 'c', storyDate: '2026-11-10' },
  ];
  assert.deepEqual(storiesOnDay(kept, '2026-11-10').map((s) => s.id), ['b', 'c']);
  assert.deepEqual(storiesOnDay(kept, '2026-11-11'), []);
});
