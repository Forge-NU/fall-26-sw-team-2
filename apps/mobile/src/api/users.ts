import type { PaginatedResponse, UserResponse } from 'shared-types';

import { apiGet } from '@/api/client';

/** API-1's example list endpoint. Needs sign-in, so it returns 401 until ACCT-1 (#29). */
export function listUsers(cursor: string | null, signal?: AbortSignal): Promise<PaginatedResponse<UserResponse>> {
  return apiGet('/api/users', { cursor, limit: 20 }, { signal });
}
