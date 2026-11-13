// The mock stories endpoints behind EXPO_PUBLIC_API_MOCKS=all (#25 STORY-3),
// so demos without the API behave like the real one. The mock backend keeps
// state between calls, so these run in order.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/api/client.ts';
import {
  me,
  mockCreateStory,
  mockDeleteStory,
  mockGetStoriesFeed,
  mockGetTripStories,
} from '../src/api/mock-backend.ts';
import { todayLocalIso } from '../src/utils/local-date.ts';

const allStories = (feed) => feed.items.flatMap((group) => group.stories);
const ownStory = async () => allStories(await mockGetStoriesFeed()).find((s) => s.owner.id === me.id);

test('the feed groups active stories by user, newest user first and each oldest first', async () => {
  const feed = await mockGetStoriesFeed();
  const latest = (group) => group.stories.at(-1).createdAt;

  assert.deepEqual(
    feed.items.map(latest),
    [...feed.items.map(latest)].sort().reverse(),
  );
  for (const group of feed.items) {
    const times = group.stories.map((s) => s.createdAt);
    assert.deepEqual(times, [...times].sort());
    assert.ok(group.stories.every((s) => s.owner.id === group.owner.id));
  }
  assert.ok(allStories(feed).every((s) => new Date(s.expiresAt).getTime() > Date.now()));
  assert.equal(feed.nextCursor, null);
});

test("someone else's draft trip has a tripId but no trip, like the real API", async () => {
  const stories = allStories(await mockGetStoriesFeed());
  const hidden = stories.find((s) => s.owner.id !== me.id && s.tripId && !s.trip);
  assert.ok(hidden, 'a follower story on a hidden draft trip');
  assert.ok(stories.some((s) => s.trip && s.trip.id === s.tripId), 'a story with a visible trip');
});

test('trip stories are only the kept ones, including expired, by story date', async () => {
  const tripId = (await ownStory()).trip.id;
  const { items } = await mockGetTripStories(tripId);

  assert.ok(items.length >= 2);
  assert.ok(items.every((s) => s.tripId === tripId && s.keepOnTrip));
  assert.ok(items.some((s) => new Date(s.expiresAt).getTime() <= Date.now()), 'an expired kept story');
  const dates = items.map((s) => s.storyDate);
  assert.deepEqual(dates, [...dates].sort());
});

test('a created story shows in the feed, and on its trip when kept', async () => {
  const tripId = (await ownStory()).trip.id;
  const created = await mockCreateStory({
    s3Key: `users/${me.id}/stories/new.jpg`,
    tripId,
    keepOnTrip: true,
    text: 'Fresh',
    date: todayLocalIso(),
  });

  assert.equal(created.trip?.id, tripId);
  assert.ok(allStories(await mockGetStoriesFeed()).some((s) => s.id === created.id));
  assert.ok((await mockGetTripStories(tripId)).items.some((s) => s.id === created.id));
});

test('the owner can delete their story, and nobody else can', async () => {
  const mine = await ownStory();
  await mockDeleteStory(mine.id);
  assert.ok(!allStories(await mockGetStoriesFeed()).some((s) => s.id === mine.id));

  const theirs = allStories(await mockGetStoriesFeed()).find((s) => s.owner.id !== me.id);
  await assert.rejects(mockDeleteStory(theirs.id), (error) => error instanceof ApiError && error.status === 404);
  assert.ok(allStories(await mockGetStoriesFeed()).some((s) => s.id === theirs.id));
});
