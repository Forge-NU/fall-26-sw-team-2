import type { PaginatedResponse, UserResponse } from 'shared-types';

import { apiGet } from '@/api/client';
import { mockDelay, withMock } from '@/api/mock';

/** API-1's example list endpoint. Needs sign-in, so it returns 401 until ACCT-1 (#29). */
export function listUsers(cursor: string | null, signal?: AbortSignal): Promise<PaginatedResponse<UserResponse>> {
  return apiGet('/api/users', { cursor, limit: 20 }, { signal });
}

/** The signed-in user, from ACCT-1's GET /api/me. Cached under ['me'], like #84's profile. */
export const getMe = withMock<[signal?: AbortSignal], UserResponse>({
  live: true,
  real: (signal) => apiGet('/api/me', undefined, { signal }),
  mock: async () => {
    await mockDelay();
    return MOCK_ME;
  },
});

/** Who the mocks are signed in as */
export const MOCK_ME: UserResponse = {
  id: 'user_mock',
  username: 'mock.traveler',
  firstName: 'Mock',
  lastName: 'Traveler',
  avatarUrl: null,
};
