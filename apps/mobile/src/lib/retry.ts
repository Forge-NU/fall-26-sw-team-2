// TODO: switch to a shared retry helper if MEDIA-1 (#38) or POST-2 (#42) adds one
import { ApiError } from '@/api/client';

// Delays between attempts (4 attempts total)
export const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

// Other 4xx errors would just fail again
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
