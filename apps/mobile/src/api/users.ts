import type { PaginatedResponse, UserResponse, UserSummary, UsernameAvailabilityResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';

/** API-1's example list endpoint. Needs sign-in. */
export function listUsers(cursor: string | null, signal?: AbortSignal): Promise<PaginatedResponse<UserSummary>> {
  return apiGet('/api/users', { cursor, limit: 20 }, { signal });
}

/** The signed-in user's profile. 404 until they finish onboarding. */
export function getMe(): Promise<UserResponse> {
  return apiGet('/api/me');
}

export function createMyProfile(body: { firstName: string; lastName: string; username: string }): Promise<UserResponse> {
  return apiRequest('POST', '/api/me/profile', body);
}

export function getUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
  return apiGet('/api/users/username-availability', { username });
}
