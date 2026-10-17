// MEDIA-1 (#38) and POST-2 (#42) also retry failed uploads. If either adds a
// shared retry helper, use it here instead.
import { ApiError } from '@/api/client';

// Waits between attempts: 4 attempts in total, about 40 seconds end to end.
export const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

// Network failures and server-side errors are worth retrying. Other 4xx
// responses (a bad request, a trip that's no longer active) will fail the
// same way again.
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
