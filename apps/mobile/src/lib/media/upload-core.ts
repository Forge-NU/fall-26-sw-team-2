// Upload logic with no app imports, so scripts/upload-core.test.mjs can run it
// under plain node. upload-photo.ts wires it to the real API and S3.

// Matches the server limit in apps/api/src/media/media-limits.ts (DOC-1)
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Ask for a new URL if the current one expires within this long
const URL_EXPIRY_MARGIN_MS = 60_000;

export type UploadTarget = { uploadUrl: string; s3Key: string; expiresAt: string };

export type UploadDeps<Body> = {
  // head is the file's first bytes, at least 3
  readFile(uri: string): Promise<{ body: Body; size: number; head: Uint8Array }>;
  createUpload(fileSize: number): Promise<UploadTarget>;
  putObject(uploadUrl: string, body: Body, onProgress: (fraction: number) => void): Promise<void>;
  isRetryable(error: unknown): boolean;
  // S3 answers 403 once a presigned URL has expired
  isExpiredUrl(error: unknown): boolean;
  sleep(ms: number): Promise<void>;
  now(): number;
};

export type UploadOptions = {
  // Delays between attempts. [] means a single attempt.
  retryDelaysMs?: readonly number[];
  // 0 to 1, for the current photo
  onProgress?: (fraction: number) => void;
};

// No parameter properties here: node's type stripping can't run them
export class PhotoTooLargeError extends Error {
  readonly size: number;

  constructor(size: number) {
    super(`Photo is ${size} bytes, over the ${MAX_PHOTO_BYTES} byte limit`);
    this.name = 'PhotoTooLargeError';
    this.size = size;
  }
}

// The server only takes JPEG (UPLOAD_CONTENT_TYPES). Every JPEG starts with FF D8 FF.
export function isJpeg(head: Uint8Array): boolean {
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export class NotJpegError extends Error {
  constructor() {
    super('Photo is not a JPEG. Run it through preparePhoto first.');
    this.name = 'NotJpegError';
  }
}

// Uploads one file and returns its S3 key. Retries reuse the upload URL until
// it's about to expire or S3 rejects it as expired.
export async function uploadWithRetry<Body>(
  uri: string,
  deps: UploadDeps<Body>,
  { retryDelaysMs = [], onProgress }: UploadOptions = {},
): Promise<string> {
  const file = await deps.readFile(uri);
  if (!isJpeg(file.head)) throw new NotJpegError();
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoTooLargeError(file.size);

  let target: UploadTarget | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      if (!target || Date.parse(target.expiresAt) - deps.now() < URL_EXPIRY_MARGIN_MS) {
        target = await deps.createUpload(file.size);
      }
      onProgress?.(0);
      await deps.putObject(target.uploadUrl, file.body, (fraction) => onProgress?.(fraction));
      onProgress?.(1);
      return target.s3Key;
    } catch (error) {
      const expired = deps.isExpiredUrl(error);
      if (expired) target = null;
      const delay = retryDelaysMs[attempt];
      if (delay === undefined || !(expired || deps.isRetryable(error))) throw error;
      await deps.sleep(delay);
    }
  }
}

export type BatchResult =
  | { status: 'uploaded'; s3Key: string }
  | { status: 'failed'; error: unknown };

export type BatchProgress = {
  // 0-based index of the photo uploading now
  index: number;
  total: number;
  // 0 to 1, for the photo uploading now
  fraction: number;
};

// Uploads files one at a time. A failure doesn't stop the rest, so a retry
// only has to redo the ones that failed.
export async function uploadBatch(
  uris: readonly string[],
  upload: (uri: string, onProgress: (fraction: number) => void) => Promise<string>,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const [index, uri] of uris.entries()) {
    const report = (fraction: number) => onProgress?.({ index, total: uris.length, fraction });
    try {
      results.push({ status: 'uploaded', s3Key: await upload(uri, report) });
    } catch (error) {
      results.push({ status: 'failed', error });
    }
  }
  return results;
}
