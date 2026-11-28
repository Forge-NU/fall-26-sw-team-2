import test from 'node:test';
import assert from 'node:assert/strict';

import { inviteRowState, withInvite, withoutInvite } from '../src/lib/invites.ts';

const invite = (id, inviteeId) => ({ id, invitee: { id: inviteeId } });

test('inviteRowState: you, invited, or invite', () => {
  const pending = [invite('i1', 'user_maya')];
  assert.equal(inviteRowState('user_me', 'user_me', pending), 'self');
  assert.equal(inviteRowState('user_maya', 'user_me', pending), 'invited');
  assert.equal(inviteRowState('user_priya', 'user_me', pending), 'invite');
  assert.equal(inviteRowState('user_priya', 'user_me', []), 'invite');
});

test('withInvite puts the new invite first, once', () => {
  const a = invite('a', 'u1');
  const b = invite('b', 'u2');
  assert.deepEqual(withInvite([a], b), [b, a]);
  assert.deepEqual(withInvite([b, a], b), [b, a]);
  assert.deepEqual(withInvite(undefined, a), [a]);
});

test('withoutInvite drops the cancelled invite', () => {
  const a = invite('a', 'u1');
  const b = invite('b', 'u2');
  assert.deepEqual(withoutInvite([a, b], 'a'), [b]);
  assert.deepEqual(withoutInvite(undefined, 'a'), []);
});
