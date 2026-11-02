import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHOTO_BYTES,
  NotJpegError,
  PhotoTooLargeError,
  uploadBatch,
  uploadWithRetry,
} from '../src/lib/media/upload-core.ts';

class HttpError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

// Fake API + S3. put is called with the attempt number and returns nothing or
// throws, to script each attempt.
const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function fakeDeps({ size = 1000, head = JPEG_HEAD, put = () => {}, now = () => 0, expiresAt = '1970-01-01T00:15:00Z' } = {}) {
  const calls = { createUpload: [], put: [], sleep: [] };
  let urls = 0;
  return {
    calls,
    deps: {
      readFile: async () => ({ body: 'bytes', size, head }),
      createUpload: async (fileSize) => {
        calls.createUpload.push(fileSize);
        urls++;
        return { uploadUrl: `https://s3.test/${urls}`, s3Key: `users/u/posts/${urls}.jpg`, expiresAt };
      },
      putObject: async (uploadUrl, body, onProgress) => {
        calls.put.push(uploadUrl);
        onProgress(0.5);
        put(calls.put.length);
      },
      isRetryable: (error) => !(error instanceof HttpError) || error.status >= 500,
      isExpiredUrl: (error) => error instanceof HttpError && error.status === 403,
      sleep: async (ms) => { calls.sleep.push(ms); },
      now,
    },
  };
}

test('uploads once and returns the key, asking for a URL with the file size', async () => {
  const { deps, calls } = fakeDeps({ size: 2483021 });
  const progress = [];
  const key = await uploadWithRetry('file://a.jpg', deps, { onProgress: (f) => progress.push(f) });
  assert.equal(key, 'users/u/posts/1.jpg');
  assert.deepEqual(calls.createUpload, [2483021]);
  assert.deepEqual(progress, [0, 0.5, 1]);
});

test('retries network errors on the same URL, waiting between attempts', async () => {
  const { deps, calls } = fakeDeps({ put: (n) => { if (n < 3) throw new TypeError('Network request failed'); } });
  const key = await uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10, 20, 30] });
  assert.equal(key, 'users/u/posts/1.jpg');
  assert.deepEqual(calls.put, ['https://s3.test/1', 'https://s3.test/1', 'https://s3.test/1']);
  assert.deepEqual(calls.sleep, [10, 20]);
});

test('gives up after the last retry and throws the error', async () => {
  const { deps, calls } = fakeDeps({ put: () => { throw new TypeError('Network request failed'); } });
  await assert.rejects(uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10, 20] }), TypeError);
  assert.equal(calls.put.length, 3);
});

test('makes one attempt by default', async () => {
  const { deps, calls } = fakeDeps({ put: () => { throw new TypeError('Network request failed'); } });
  await assert.rejects(uploadWithRetry('file://a.jpg', deps));
  assert.equal(calls.put.length, 1);
});

test("doesn't retry errors that would just fail again", async () => {
  const { deps, calls } = fakeDeps({ put: () => { throw new HttpError(400); } });
  await assert.rejects(uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10, 20] }), HttpError);
  assert.equal(calls.put.length, 1);
});

test('gets a new URL after S3 rejects one as expired', async () => {
  const { deps, calls } = fakeDeps({ put: (n) => { if (n === 1) throw new HttpError(403); } });
  const key = await uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10] });
  assert.equal(key, 'users/u/posts/2.jpg');
  assert.deepEqual(calls.put, ['https://s3.test/1', 'https://s3.test/2']);
});

test('gets a new URL before retrying when the current one is about to expire', async () => {
  let time = 0;
  const { deps, calls } = fakeDeps({
    now: () => time,
    put: (n) => { if (n === 1) { time = 14.5 * 60 * 1000; throw new TypeError('Network request failed'); } },
  });
  await uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10] });
  assert.equal(calls.createUpload.length, 2);
});

test('rejects a file over 10 MB without asking for a URL', async () => {
  const { deps, calls } = fakeDeps({ size: MAX_PHOTO_BYTES + 1 });
  await assert.rejects(uploadWithRetry('file://a.jpg', deps, { retryDelaysMs: [10] }), PhotoTooLargeError);
  assert.equal(calls.createUpload.length, 0);
});

test('rejects a file that is not a JPEG without asking for a URL', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const { deps, calls } = fakeDeps({ head: png });
  await assert.rejects(uploadWithRetry('file://a.png', deps, { retryDelaysMs: [10] }), NotJpegError);
  assert.equal(calls.createUpload.length, 0);
});

test('rejects an empty file as not a JPEG', async () => {
  const { deps } = fakeDeps({ size: 0, head: new Uint8Array() });
  await assert.rejects(uploadWithRetry('file://a.jpg', deps), NotJpegError);
});

test('a batch uploads in order, keeps going after a failure, and reports progress', async () => {
  const order = [];
  const progress = [];
  const results = await uploadBatch(
    ['a', 'b', 'c'],
    async (uri, onProgress) => {
      order.push(uri);
      onProgress(1);
      if (uri === 'b') throw new Error('nope');
      return `key-${uri}`;
    },
    (p) => progress.push(p),
  );
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(results.map((r) => r.status), ['uploaded', 'failed', 'uploaded']);
  assert.equal(results[2].s3Key, 'key-c');
  assert.deepEqual(progress, [
    { index: 0, total: 3, fraction: 1 },
    { index: 1, total: 3, fraction: 1 },
    { index: 2, total: 3, fraction: 1 },
  ]);
});

test('10 photos on a flaky connection all upload with retries', async () => {
  let puts = 0;
  const { deps } = fakeDeps({ put: () => { if (++puts % 2 === 1) throw new TypeError('Network request failed'); } });
  const uris = Array.from({ length: 10 }, (_, i) => `file://${i}.jpg`);
  const results = await uploadBatch(uris, (uri, onProgress) =>
    uploadWithRetry(uri, deps, { retryDelaysMs: [10, 20, 30], onProgress }),
  );
  assert.ok(results.every((r) => r.status === 'uploaded'));
});
