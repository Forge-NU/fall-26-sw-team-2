import test from 'node:test';
import assert from 'node:assert/strict';
import { showToast, subscribeToToasts } from '../src/lib/toast.ts';

test('API notifications are dropped before mount and after provider cleanup', () => {
  assert.equal(showToast({ message: 'Before mount' }), false);
  const received = [];
  const cleanup = subscribeToToasts(options => received.push(options));
  try {
    assert.equal(showToast({ message: 'Server failed', variant: 'error', duration: 0 }), true);
    assert.deepEqual(received, [{ message: 'Server failed', variant: 'error', duration: 0 }]);
  } finally { cleanup(); }
  assert.equal(showToast({ message: 'After unmount' }), false);
});

test('empty notifications cannot replace a useful message', () => {
  const received = [];
  const cleanup = subscribeToToasts(options => received.push(options));
  try {
    showToast({ message: 'Useful message' });
    assert.equal(showToast({ message: '  ' }), false);
    assert.equal(received.length, 1);
  } finally { cleanup(); }
});
