// Profile and follow endpoints for PROF-1 (#31): FOL-1's follow routes, ACCT-1's
// user routes, TRIP-1's profile trips and PROF-3's profile posts.
import type {
  FollowListUser,
  FollowStatus,
  PaginatedResponse,
  PostResponse,
  TripResponse,
  UpdateMeRequest,
  UserResponse,
  UserSummary,
} from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { me as mockMe } from '@/api/mock-backend';
import { getMe } from '@/api/users';

export type FollowList = 'followers' | 'following';

type ListFetcher<T> = (userId: string, cursor: string | null, signal?: AbortSignal) => Promise<PaginatedResponse<T>>;

// The follow and trip routes take an id at /api/users/:id/...; the profile itself
// is /api/users/id/:id, since /api/users/:username looks people up by username.
const userPath = (id: string) => `/api/users/${encodeURIComponent(id)}`;

/** The signed-in user with their follow counts */
export const getMyProfile = withMock<[signal?: AbortSignal], UserResponse>({
  live: true,
  real: getMe,
  mock: async () => {
    await mockDelay();
    return mockProfile(MOCK_ME_ID);
  },
});

export const updateMe = withMock<[body: UpdateMeRequest], UserResponse>({
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

/**
 * Deletes the signed-in user's account and everything they own, including their
 * media and Clerk user (ACCT-1, #29). Sign out afterwards: the session is gone.
 */
export const deleteMe = withMock<[], void>({
  live: true,
  real: () => apiRequest('DELETE', '/api/me'),
  mock: async () => {
    await mockDelay();
  },
});

export const getProfile = withMock<[id: string, signal?: AbortSignal], UserResponse>({
  live: true,
  real: (id, signal) => apiGet(`/api/users/id/${encodeURIComponent(id)}`, undefined, { signal }),
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

/** Newest first. Posts in drafts are only included on your own profile. */
export const listUserPosts = withMock<Parameters<ListFetcher<PostResponse>>, PaginatedResponse<PostResponse>>({
  live: true,
  real: (id, cursor, signal) => apiGet(`${userPath(id)}/posts`, { cursor, limit: 30 }, { signal }),
  mock: async (id, cursor) => {
    await mockDelay();
    const author = mockUser(id);
    const trips = mockTrips(author).filter((trip) => id === MOCK_ME_ID || trip.status === 'published');
    // Already newest first: trips are newest first, and each trip's posts are built from its last day back
    const posts = trips.flatMap((trip, t) =>
      Array.from({ length: MOCK_POSTS_PER_TRIP }, (_, i) => mockPost(author, trip, i, t * MOCK_POSTS_PER_TRIP + i)),
    );
    return mockPage(posts, cursor, 30);
  },
});

export const followListFetchers: Record<FollowList, ListFetcher<FollowListUser>> = {
  followers: listFollowers,
  following: listFollowing,
};

// Mocks: the signed-in user (the same one AuthGate signs in as), 30 travelers, and who follows whom

const MOCK_ME_ID = mockMe.id;
const MOCK_TIMESTAMP = '2026-06-01T12:00:00.000Z';
const FIRST_NAMES = ['Nine', 'Duke', 'Maya', 'Priya', 'Noah', 'Jordan', 'Sofia', 'Kenji', 'Amara', 'Leo'];
const DESTINATIONS = ['Boston, MA', 'Lake Tahoe, CA', 'Paris, France', 'Osaka, Japan', 'Barcelona, Spain', 'New York City, NY'];

const mockUsers: UserSummary[] = [
  mockMe,
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

function mockUser(id: string): UserSummary {
  return mockUsers.find((user) => user.id === id) ?? mockError(404, 'User not found', userPath(id));
}

function mockProfile(id: string): UserResponse {
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

const MOCK_POSTS_PER_TRIP = 6;
// picsum.photos image IDs, like the posts in mock-backend.ts
const MOCK_PHOTO_IDS = [431, 429, 1047, 1040, 1039, 416, 1018, 1050, 164, 211, 1043, 1036];

// Post `i` of `trip`, counting back from its last day (mock trips are the 1st to
// the 5th of a month). `n` only picks the photo.
function mockPost(author: UserSummary, trip: TripResponse, i: number, n: number): PostResponse {
  const day = 5 - Math.floor((i * 5) / MOCK_POSTS_PER_TRIP);
  return {
    id: `${trip.id}-post-${i + 1}`,
    tripId: trip.id,
    author,
    caption: null,
    visitedOn: `${trip.startDate.slice(0, 8)}0${day}`,
    location: null,
    customLocationName: trip.destination,
    rating: null,
    media: [
      {
        id: `${trip.id}-media-${i + 1}`,
        mediaType: 'image',
        url: `https://picsum.photos/id/${MOCK_PHOTO_IDS[n % MOCK_PHOTO_IDS.length]}/900/1200`,
        width: 900,
        height: 1200,
        durationMs: null,
      },
    ],
    likeCount: 0,
    saveCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  };
}

function mockTrips(owner: UserSummary): TripResponse[] {
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
    // Matches the Posts tab, which builds this many per trip
    postCount: MOCK_POSTS_PER_TRIP,
    coverImageUrl: null,
    saveCount: 0,
    savedByMe: false,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
  }));
}
