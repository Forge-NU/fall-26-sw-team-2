import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustReplyCount,
  appendComment,
  bodyToSend,
  canSendComment,
  commentLength,
  formatTimeAgo,
  removeComment,
  replyPrefill,
} from '../src/lib/comment-cache.ts';

const user = (id, username) => ({ id, username, firstName: '', lastName: '', avatarUrl: null });
const maya = user('maya', 'maya.chen');
const me = user('me', 'mock.traveler');
const comment = (id, author, parentCommentId = null, replyCount = 0) => ({
  id, postId: 'p1', parentCommentId, author, replyTo: null, body: 'hi', replyCount, createdAt: '2026-10-01T00:00:00Z',
});

test('the composer is off when empty, blank or over 500 characters', () => {
  assert.equal(canSendComment(''), false);
  assert.equal(canSendComment('   \n '), false);
  assert.equal(canSendComment('a'.repeat(500)), true);
  assert.equal(canSendComment('a'.repeat(501)), false);
  assert.equal(canSendComment(`  ${'a'.repeat(500)}  `), true);
});

test('length counts code points, like Postgres', () => {
  assert.equal(commentLength('❤️'), 2);
  assert.equal(commentLength('😀'), 1);
});

test('replying to a reply prefills the @mention, but not for a top-level comment or your own reply', () => {
  assert.equal(replyPrefill(comment('r1', maya, 'c1'), 'me'), '@maya.chen ');
  assert.equal(replyPrefill(comment('c1', maya), 'me'), '');
  assert.equal(replyPrefill(comment('r2', me, 'c1'), 'me'), '');
});

test('the prefilled @mention comes off the body, since the API stores it as replyTo', () => {
  const target = comment('r1', maya, 'c1');
  assert.equal(bodyToSend('@maya.chen  Same here! ', target, 'me'), 'Same here!');
  assert.equal(bodyToSend('@maya.chen ', target, 'me'), '');
  assert.equal(bodyToSend('@maya.chenx hi', target, 'me'), '@maya.chenx hi');
  assert.equal(bodyToSend('Same here', target, 'me'), 'Same here');
  assert.equal(bodyToSend(' @maya.chen hi ', null, 'me'), '@maya.chen hi');
});

const pages = (...lists) => ({ pages: lists.map((items) => ({ items, nextCursor: null })), pageParams: lists.map(() => null) });

test('appendComment adds to the end of the last loaded page', () => {
  const data = pages([comment('a', maya)], [comment('b', maya)]);
  const next = appendComment(data, comment('c', me));
  assert.deepEqual(next.pages[1].items.map((c) => c.id), ['b', 'c']);
  assert.equal(next.pages[0], data.pages[0]);
  assert.equal(appendComment(undefined, comment('c', me)), undefined);
});

test('removeComment and adjustReplyCount leave other lists untouched', () => {
  const data = pages([comment('a', maya, null, 2), comment('b', maya)]);
  assert.deepEqual(removeComment(data, 'a').pages[0].items.map((c) => c.id), ['b']);
  assert.equal(removeComment(data, 'nope'), data);
  assert.equal(adjustReplyCount(data, 'a', -1).pages[0].items[0].replyCount, 1);
  assert.equal(adjustReplyCount(data, 'b', -1).pages[0].items[1].replyCount, 0);
  assert.equal(adjustReplyCount(data, 'nope', 1), data);
});

test('formatTimeAgo uses short Instagram-style units', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  assert.equal(formatTimeAgo('2026-10-31T11:59:30Z', now), 'now');
  assert.equal(formatTimeAgo('2026-10-31T11:55:00Z', now), '5m');
  assert.equal(formatTimeAgo('2026-10-31T09:00:00Z', now), '3h');
  assert.equal(formatTimeAgo('2026-10-29T12:00:00Z', now), '2d');
  assert.equal(formatTimeAgo('2026-10-03T12:00:00Z', now), '4w');
});
