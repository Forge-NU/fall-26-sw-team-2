// POST /api/media/uploads (MEDIA-1, #38), then a PUT straight to S3.
// See docs/architecture/media-uploads.md.
import type { CreateUploadRequest, CreateUploadResponse, UploadPurpose } from '@/api/types';

import { ApiError, apiRequest, USE_MOCK_API } from '@/api/client';

export function createUpload(request: CreateUploadRequest): Promise<CreateUploadResponse> {
  if (USE_MOCK_API) return mockCreateUpload(request.purpose);
  return apiRequest('POST', '/api/media/uploads', request);
}

// The size has to match the fileSize sent to createUpload, so read it from
// the same blob that gets uploaded.
export async function readFile(uri: string): Promise<{ body: Blob; size: number }> {
  const body = await (await fetch(uri)).blob();
  return { body, size: body.size };
}

// XMLHttpRequest rather than fetch, since fetch can't report upload progress.
// The blob sets Content-Length; S3 rejects the PUT if it or the content type
// doesn't match what the URL was signed for.
export function putObject(
  uploadUrl: string,
  body: Blob,
  contentType: CreateUploadRequest['contentType'],
  onProgress?: (fraction: number) => void,
): Promise<void> {
  if (USE_MOCK_API) return mockPutObject(onProgress);

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

// Mock mode (USE_MOCK_API). EXPO_PUBLIC_MOCK_UPLOAD_FAILURE_RATE=1 in .env
// makes every upload fail, for checking retry flows. Leave it unset.
const MOCK_UPLOAD_FAILURE_RATE = Number(process.env.EXPO_PUBLIC_MOCK_UPLOAD_FAILURE_RATE ?? 0);
const MOCK_FOLDERS: Record<UploadPurpose, string> = {
  post: 'posts',
  story: 'stories',
  avatar: 'avatars',
};
let mockUploadCount = 0;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mockCreateUpload(purpose: UploadPurpose): Promise<CreateUploadResponse> {
  await delay(200);
  const s3Key = `users/mock-user/${MOCK_FOLDERS[purpose]}/mock-${Date.now()}-${++mockUploadCount}.jpg`;
  return {
    s3Key,
    uploadUrl: `https://mock-upload.invalid/${s3Key}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

async function mockPutObject(onProgress?: (fraction: number) => void): Promise<void> {
  for (let step = 1; step <= 5; step++) {
    await delay(200);
    onProgress?.(step / 5);
  }
  if (Math.random() < MOCK_UPLOAD_FAILURE_RATE) {
    throw new TypeError('Network request failed (mock)');
  }
}
