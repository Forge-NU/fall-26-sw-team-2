// Profile and follow endpoints for PROF-1 (#31): FOL-1's follow routes, ACCT-1's
// user routes and TRIP-1's profile trips are live; a user's posts aren't yet.
import type { PaginatedResponse, PostResponse, TripResponse, UserResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';

// Copied from apps/api/src/follows/follow-list.types.ts until they move to shared-types

export type FollowCounts = {
  followerCount: number;
  followingCount: number;
};

/** GET /api/me and GET /api/users/:id add the follow counts to the user */
export type ProfileResponse = UserResponse & FollowCounts;

export type FollowListUser = UserResponse & {
  /** Whether the signed-in user follows this person */
  isFollowing: boolean;
};

export type FollowStatus = { isFollowing: boolean };

export type FollowList = 'followers' | 'following';

type ListFetcher<T> = (userId: string, cursor: string | null, signal?: AbortSignal) => Promise<PaginatedResponse<T>>;

const userPath = (id: string) => `/api/users/${encodeURIComponent(id)}`;

export const getMe = withMock<[signal?: AbortSignal], ProfileResponse>({
  live: true,
  real: (signal) => apiGet('/api/me', undefined, { signal }),
  mock: async () => {
    await mockDelay();
    return mockProfile(MOCK_ME_ID);
  },
});

/** Body of PATCH /api/me. avatarKey is an s3Key from an "avatar" upload, or null to remove it. */
export type UpdateMeRequest = {
  firstName?: string;
  lastName?: string;
  avatarKey?: string | null;
};

export const updateMe = withMock<[body: UpdateMeRequest], ProfileResponse>({
  live: true,
  real: (body) => apiRequest('PATCH', '/api/me', body),
  mock: async ({ avatarKey, ...names }) => {
    await mockDelay();
    const me = mockUser(MOCK_ME_ID);
    Object.assign(me, names);
    // Mock uploads don't store anything, so there's no photo to show
    if (avatarKey !== undefined) me.avatarUrl = null;
    return mockProfile(MOCK_ME_ID);
  },
});

export const getProfile = withMock<[id: string, signal?: AbortSignal], ProfileResponse>({
  live: true,
  real: (id, signal) => apiGet(userPath(id), undefined, { signal }),
  mock: async (id) => {
    await mockDelay();
    return mockProfile(id);
  },
});

export const getFollowStatus = withMock<[id: string, signal?: AbortSignal], FollowStatus>({
  live: true,
  real: (id, signal) => apiGet(`${userPath(id)}/follow-status`, undefined, { signal }),
  mock: async (id) => {
    await mockDelay();
    mockUser(id);
    return { isFollowing: mockFollows.has(followKey(MOCK_ME_ID, id)) };
  },
});

export const followUser = withMock<[id: string], void>({
  live: true,
  real: async (id) => {
    await apiRequest('POST', `${userPath(id)}/follow`);
  },
  mock: async (id) => {
    await mockDelay();
    if (id === MOCK_ME_ID) mockError(400, 'Cannot follow yourself', `${userPath(id)}/follow`);
    mockUser(id);
    mockFollows.add(followKey(MOCK_ME_ID, id));
  },
});

export const unfollowUser = withMock<[id: string], void>({
  live: true,
  real: (id) => apiRequest('DELETE', `${userPath(id)}/follow`),
  mock: async (id) => {
    await mockDelay();
    mockUser(id);
    mockFollows.delete(followKey(MOCK_ME_ID, id));
  },
});

export const listFollowers = withMock<Parameters<ListFetcher<FollowListUser>>, PaginatedResponse<FollowListUser>>({
  live: true,
  real: (id, cursor, signal) => apiGet(`${userPath(id)}/followers`, { cursor, limit: 20 }, { signal }),
  mock: (id, cursor) => mockFollowList(id, 'followers', cursor),
});

export const listFollowing = withMock<Parameters<ListFetcher<FollowListUser>>, PaginatedResponse<FollowListUser>>({
  live: true,
  real: (id, cursor, signal) => apiGet(`${userPath(id)}/following`, { cursor, limit: 20 }, { signal }),
  mock: (id, cursor) => mockFollowList(id, 'following', cursor),
});

/** Newest first. Drafts are only included on your own profile. */
export const listUserTrips = withMock<Parameters<ListFetcher<TripResponse>>, PaginatedResponse<TripResponse>>({
  live: true,
  real: (id, cursor, signal) => apiGet(`${userPath(id)}/trips`, { cursor, limit: 20 }, { signal }),
  mock: async (id, cursor) => {
    await mockDelay();
    const owner = mockUser(id);
    const trips = mockTrips(owner).filter((trip) => id === MOCK_ME_ID || trip.status === 'published');
    return mockPage(trips, cursor);
  },
});

/** Not built yet: there's no GET /api/users/:id/posts on the API. */
export const listUserPosts = withMock<Parameters<ListFetcher<PostResponse>>, PaginatedResponse<PostResponse>>({
  live: false,
  real: (id, cursor, signal) => apiGet(`${userPath(id)}/posts`, { cursor, limit: 30 }, { signal }),
  mock: async (id, cursor) => {
    await mockDelay();
    const author = mockUser(id);
    const posts = Array.from({ length: 40 }, (_, i): PostResponse => ({
      id: `${id}-post-${i + 1}`,
      tripId: `${id}-trip-1`,
      author,
      caption: null,
      visitedOn: '2026-06-01',
      location: null,
      customLocationName: null,
      media: [],
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    }));
    return mockPage(posts, cursor, 30);
  },
});

export const followListFetchers: Record<FollowList, ListFetcher<FollowListUser>> = {
  followers: listFollowers,
  following: listFollowing,
};

// Mocks: the signed-in user, 30 travelers, and who follows whom

export const MOCK_ME_ID = 'mock-me';
const MOCK_TIMESTAMP = '2026-06-01T12:00:00.000Z';
const FIRST_NAMES = ['Nine', 'Duke', 'Maya', 'Priya', 'Noah', 'Jordan', 'Sofia', 'Kenji', 'Amara', 'Leo'];
const DESTINATIONS = ['Boston, MA', 'Lake Tahoe, CA', 'Paris, France', 'Osaka, Japan', 'Barcelona, Spain', 'New York City, NY'];

const mockUsers: UserResponse[] = [
  { id: MOCK_ME_ID, firstName: 'Nine', lastName: 'Vicious', username: 'nine_vicious', avatarUrl: null },
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `mock-traveler-${i + 1}`,
    firstName: FIRST_NAMES[(i + 1) % FIRST_NAMES.length],
    lastName: 'Traveler',
    username: `${FIRST_NAMES[(i + 1) % FIRST_NAMES.length].toLowerCase()}_${i + 1}`,
    avatarUrl: null,
  })),
];

const followKey = (followerId: string, followingId: string) => `${followerId}>${followingId}`;

// You follow the first 16 travelers, and every third one follows you back
const mockFollows = new Set<string>(
  mockUsers.slice(1).flatMap((user, i) => [
    ...(i < 16 ? [followKey(MOCK_ME_ID, user.id)] : []),
    ...(i % 3 === 0 ? [followKey(user.id, MOCK_ME_ID)] : []),
  ]),
);

function mockUser(id: string): UserResponse {
  return mockUsers.find((user) => user.id === id) ?? mockError(404, 'User not found', userPath(id));
}

function mockProfile(id: string): ProfileResponse {
  const user = mockUser(id);
  const keys = [...mockFollows];
  return {
    ...user,
    followerCount: keys.filter((key) => key.endsWith(`>${id}`)).length,
    followingCount: keys.filter((key) => key.startsWith(`${id}>`)).length,
  };
}

async function mockFollowList(id: string, list: FollowList, cursor: string | null) {
  await mockDelay();
  mockUser(id);
  const people = mockUsers.filter((user) =>
    mockFollows.has(list === 'followers' ? followKey(user.id, id) : followKey(id, user.id)),
  );
  return mockPage(
    people.map((user) => ({ ...user, isFollowing: mockFollows.has(followKey(MOCK_ME_ID, user.id)) })),
    cursor,
  );
}

function mockTrips(owner: UserResponse): TripResponse[] {
  return DESTINATIONS.map((destination, i) => ({
    id: `${owner.id}-trip-${i + 1}`,
    owner,
    title: destination.split(',')[0],
    destination,
    description: null,
    startDate: `2026-0${6 - Math.min(i, 5)}-01`,
    endDate: `2026-0${6 - Math.min(i, 5)}-05`,
    // Your newest two trips are still drafts
    status: i < 2 ? 'draft' : 'published',
    publishedAt: i < 2 ? null : MOCK_TIMESTAMP,
    postCount: [14, 9, 52, 77, 82, 49][i],
    coverImageUrl: null,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  }));
}
