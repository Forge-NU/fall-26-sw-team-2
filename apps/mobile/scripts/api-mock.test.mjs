import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/api/client.ts';
import { mockError, mockPage, withMock } from '../src/api/mock.ts';

const endpoint = (live) =>
  withMock({ live, real: async (id) => `real ${id}`, mock: async (id) => `mock ${id}` });

function withMode(mode, run) {
  const previous = process.env.EXPO_PUBLIC_API_MOCKS;
  if (mode === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
  else process.env.EXPO_PUBLIC_API_MOCKS = mode;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_API_MOCKS;
    else process.env.EXPO_PUBLIC_API_MOCKS = previous;
  }
}

test('by default only endpoints that are not live yet are mocked', async () => {
  await withMode(undefined, async () => {
    assert.equal(await endpoint(false)('a'), 'mock a');
    assert.equal(await endpoint(true)('a'), 'real a');
  });
});

test('"all" mocks every endpoint and "none" mocks nothing', async () => {
  await withMode('all', async () => assert.equal(await endpoint(true)('a'), 'mock a'));
  await withMode('none', async () => assert.equal(await endpoint(false)('a'), 'real a'));
});

test('mockPage walks the list a page at a time and ends with a null cursor', () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const first = mockPage(items, null, 2);
  assert.deepEqual(first, { items: [0, 1], nextCursor: '2' });
  assert.deepEqual(mockPage(items, first.nextCursor, 2), { items: [2, 3], nextCursor: '4' });
  assert.deepEqual(mockPage(items, '4', 2), { items: [4], nextCursor: null });
  assert.deepEqual(mockPage([], null), { items: [], nextCursor: null });
});

test('mockError throws the same ApiError a real error response would', () => {
  assert.throws(
    () => mockError(404, 'Trip not found', '/api/trips/x'),
    (error) =>
      error instanceof ApiError &&
      error.status === 404 &&
      error.message === 'Trip not found' &&
      error.body.error === 'Not Found' &&
      error.body.path === '/api/trips/x',
  );
});
