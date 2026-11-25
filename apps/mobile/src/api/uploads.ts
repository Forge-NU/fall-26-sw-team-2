// POST /api/media/uploads (MEDIA-1, #38), then a PUT straight to S3.
// See docs/architecture/media-uploads.md.
import type { CreateUploadRequest, CreateUploadResponse, UploadPurpose } from 'shared-types';

import { ApiError, apiRequest } from '@/api/client';
import { mockDelay, withMock } from '@/api/mock';

export const createUpload = withMock({
  live: true,
  real: (request: CreateUploadRequest) =>
    apiRequest<CreateUploadResponse>('POST', '/api/media/uploads', request),
  mock: (request: CreateUploadRequest) => mockCreateUpload(request.purpose),
});

// The size has to match the fileSize sent to createUpload, so read it from
// the same blob that gets uploaded. head is the first bytes, for the JPEG check.
export async function readFile(
  uri: string,
): Promise<{ body: Blob; size: number; head: Uint8Array }> {
  const body = await (await fetch(uri)).blob();
  return { body, size: body.size, head: await readBytes(body.slice(0, 3)) };
}

// FileReader rather than blob.arrayBuffer(), which React Native doesn't have
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

type ContentType = CreateUploadRequest['contentType'];
type OnProgress = (fraction: number) => void;

export const putObject = withMock({
  live: true,
  real: putToS3,
  mock: (_uploadUrl: string, _body: Blob, _contentType: ContentType, onProgress?: OnProgress) =>
    mockPutObject(onProgress),
});

// XMLHttpRequest rather than fetch, since fetch can't report upload progress.
// The blob sets Content-Length; S3 rejects the PUT if it or the content type
// doesn't match what the URL was signed for.
function putToS3(
  uploadUrl: string,
  body: Blob,
  contentType: ContentType,
  onProgress?: OnProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(xhr.status, `Upload failed with ${xhr.status}`));
    };
    // Same error fetch throws, so isRetryableError treats it as a network failure
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'));
    xhr.send(body);
  });
}

// Mocks (EXPO_PUBLIC_API_MOCKS=all). EXPO_PUBLIC_MOCK_UPLOAD_FAILURE_RATE=1 in .env
// makes every upload fail, for checking retry flows. Leave it unset.
const MOCK_UPLOAD_FAILURE_RATE = Number(process.env.EXPO_PUBLIC_MOCK_UPLOAD_FAILURE_RATE ?? 0);
const MOCK_FOLDERS: Record<UploadPurpose, string> = {
  post: 'posts',
  story: 'stories',
  avatar: 'avatars',
};
let mockUploadCount = 0;

async function mockCreateUpload(purpose: UploadPurpose): Promise<CreateUploadResponse> {
  await mockDelay(200);
  const s3Key = `users/mock-user/${MOCK_FOLDERS[purpose]}/mock-${Date.now()}-${++mockUploadCount}.jpg`;
  return {
    s3Key,
    uploadUrl: `https://mock-upload.invalid/${s3Key}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

async function mockPutObject(onProgress?: OnProgress): Promise<void> {
  for (let step = 1; step <= 5; step++) {
    await mockDelay(200);
    onProgress?.(step / 5);
  }
  if (Math.random() < MOCK_UPLOAD_FAILURE_RATE) {
    throw new TypeError('Network request failed (mock)');
  }
}
