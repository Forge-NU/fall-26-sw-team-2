import test from 'node:test';
import assert from 'node:assert/strict';

import { hasChanges, nameChanges, nameError } from '../src/lib/edit-profile.ts';

const saved = { firstName: 'Nine', lastName: 'Vicious' };

test('nameChanges sends only the names that changed, trimmed', () => {
  assert.deepEqual(nameChanges(saved, { firstName: ' Nine ', lastName: 'V' }), { lastName: 'V' });
  assert.deepEqual(nameChanges(saved, { ...saved }), {});
});

test('hasChanges counts a new or removed avatar, and ignores whitespace-only edits', () => {
  assert.equal(hasChanges(saved, { firstName: 'Nine  ', lastName: 'Vicious' }), false);
  assert.equal(hasChanges(saved, { ...saved, avatar: { uri: 'file:///a.jpg' } }), true);
  assert.equal(hasChanges(saved, { ...saved, avatar: null }), true);
});

test('nameError needs a first name and caps the length', () => {
  assert.equal(nameError('   ', true), 'Add your first name');
  assert.equal(nameError('', false), undefined);
  assert.match(nameError('a'.repeat(51), false), /under 50/);
  assert.equal(nameError('Ada', true), undefined);
});
