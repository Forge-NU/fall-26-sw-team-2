import test from 'node:test';
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
const { ApiError, apiGet, apiRequest, getErrorMessage } = await import('../src/api/client.ts');
const { setAuthTokenGetter } = await import('../src/lib/auth.ts');

let calls = [];
function respondWith(status, body) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
}

test.beforeEach(() => {
  calls = [];
  setAuthTokenGetter(async () => null);
});

test('sends JSON to the base URL, and the token only when there is one', async () => {
  respondWith(200, { id: 'trip-1' });
  assert.deepEqual(await apiRequest('POST', '/api/trips', { title: 'Lisbon' }), { id: 'trip-1' });
  assert.equal(calls[0].url, 'http://api.test/api/trips');
  assert.equal(calls[0].init.body, '{"title":"Lisbon"}');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.headers.Authorization, undefined);

  setAuthTokenGetter(async () => 'token-123');
  await apiRequest('GET', '/api/me');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer token-123');
  assert.equal(calls[1].init.headers['Content-Type'], undefined);
});

test('apiGet leaves out empty query values', async () => {
  respondWith(200, { items: [], nextCursor: null });
  await apiGet('/api/feed', { limit: 20, cursor: undefined, tripId: null });
  assert.equal(calls[0].url, 'http://api.test/api/feed?limit=20');
});

test('an empty response body comes back as undefined', async () => {
  respondWith(204);
  assert.equal(await apiRequest('DELETE', '/api/trips/trip-1'), undefined);
});

test("the API's error body becomes an ApiError with its message", async () => {
  const body = {
    statusCode: 404,
    message: 'Trip not found',
    error: 'Not Found',
    path: '/api/trips/x',
    timestamp: '2026-10-20T00:00:00.000Z',
  };
  respondWith(404, body);
  const error = await apiRequest('GET', '/api/trips/x').catch((e) => e);
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 404);
  assert.equal(error.message, 'Trip not found');
  assert.deepEqual(error.body, body);
  assert.equal(getErrorMessage(error), 'Trip not found');
});

test('a non-API error body still gives an ApiError with the status', async () => {
  globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
  const error = await apiRequest('GET', '/api/feed').catch((e) => e);
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 502);
  assert.equal(error.body, null);
  assert.equal(getErrorMessage(error), 'Something went wrong on our end. Try again.');
});

test("network failures aren't ApiErrors, so callers can tell them apart", async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Network request failed');
  };
  const error = await apiRequest('GET', '/api/feed').catch((e) => e);
  assert.ok(!(error instanceof ApiError));
  assert.match(getErrorMessage(error), /Couldn't reach the server/);
});

test('a 401 asks the user to sign in again', () => {
  assert.match(getErrorMessage(new ApiError(401, 'Unauthorized')), /signed out/);
});
