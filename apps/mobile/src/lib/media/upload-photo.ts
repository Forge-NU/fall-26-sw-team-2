// The one way to get a photo into S3, for posts, stories and avatars. Photos
// should already be through preparePhoto.
//
//   const s3Key = await uploadPhoto(photo.uri, 'post', { onProgress });
//
// Screens that just need "upload these and tell me how it's going" can use
// usePhotoUpload instead.
import type { UploadPurpose } from '@/api/types';

import { ApiError } from '@/api/client';
import { createUpload, putObject, readFile } from '@/api/uploads';
import {
  uploadBatch,
  uploadWithRetry,
  type BatchProgress,
  type BatchResult,
  type UploadDeps,
  type UploadOptions,
} from '@/lib/media/upload-core';
import { isRetryableError, RETRY_DELAYS_MS, sleep } from '@/lib/retry';

export { MAX_PHOTO_BYTES, PhotoTooLargeError } from '@/lib/media/upload-core';
export type { BatchProgress, BatchResult, UploadOptions } from '@/lib/media/upload-core';

const CONTENT_TYPE = 'image/jpeg';

function deps(purpose: UploadPurpose): UploadDeps<Blob> {
  return {
    readFile,
    createUpload: (fileSize) => createUpload({ purpose, contentType: CONTENT_TYPE, fileSize }),
    putObject: (uploadUrl, body, onProgress) =>
      putObject(uploadUrl, body, CONTENT_TYPE, onProgress),
    isRetryable: isRetryableError,
    isExpiredUrl: (error) => error instanceof ApiError && error.status === 403,
    sleep,
    now: Date.now,
  };
}

// Uploads one photo and returns its S3 key. Retries network and server errors
// RETRY_DELAYS_MS apart by default; pass retryDelaysMs: [] for one attempt
// when the caller does its own retries.
export function uploadPhoto(
  uri: string,
  purpose: UploadPurpose,
  { retryDelaysMs = RETRY_DELAYS_MS, onProgress }: UploadOptions = {},
): Promise<string> {
  return uploadWithRetry(uri, deps(purpose), { retryDelaysMs, onProgress });
}

// Uploads photos one at a time and returns a result for each, in order. One
// failure doesn't stop the rest.
export function uploadPhotos(
  uris: readonly string[],
  purpose: UploadPurpose,
  {
    retryDelaysMs,
    onProgress,
  }: { retryDelaysMs?: readonly number[]; onProgress?: (progress: BatchProgress) => void } = {},
): Promise<BatchResult[]> {
  return uploadBatch(
    uris,
    (uri, onPhotoProgress) =>
      uploadPhoto(uri, purpose, { retryDelaysMs, onProgress: onPhotoProgress }),
    onProgress,
  );
}
