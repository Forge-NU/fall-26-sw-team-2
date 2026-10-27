import { ApiError } from '@/api/client';

// Turns a failed request into something to show the user. Error bodies aren't
// parsed until API-1 (#28) settles the error shape, so this goes by status.
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "This trip doesn't exist anymore.";
    if (error.status === 403) return "Only the trip's owner can change it.";
    if (error.status === 401) return 'Sign in again to keep going.';
  }
  if (error instanceof TypeError) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}
