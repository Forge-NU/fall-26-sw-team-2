import type { PaginatedResponse, UserResponse, UsernameAvailabilityResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';

/** API-1's example list endpoint. Needs sign-in. */
export function listUsers(cursor: string | null, signal?: AbortSignal): Promise<PaginatedResponse<UserResponse>> {
  return apiGet('/api/users', { cursor, limit: 20 }, { signal });
}

// Copied from apps/api/src/follows/follow-list.types.ts until they move to shared-types
export type FollowCounts = {
  followerCount: number;
  followingCount: number;
};

/** GET /api/me and GET /api/users/id/:id add the follow counts to the user */
export type ProfileResponse = UserResponse & FollowCounts;

/** The signed-in user's profile. 404 until they finish onboarding. */
export function getMe(signal?: AbortSignal): Promise<ProfileResponse> {
  return apiGet('/api/me', undefined, { signal });
}

export function createMyProfile(body: { firstName: string; lastName: string; username: string }): Promise<UserResponse> {
  return apiRequest('POST', '/api/me/profile', body);
}

export function getUsernameAvailability(username: string): Promise<UsernameAvailabilityResponse> {
  return apiGet('/api/users/username-availability', { username });
}
