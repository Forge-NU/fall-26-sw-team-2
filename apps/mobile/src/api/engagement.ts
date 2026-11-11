// Likes and saves for INT-3 (#51), on INT-1's endpoints (#49, see
// docs/architecture/likes-and-saves.md). The mocks are for running the app
// with EXPO_PUBLIC_API_MOCKS=all, before sign-in works.
import type {
  LikeStatusResponse,
  PaginatedResponse,
  PostLikerResponse,
  PostResponse,
  SaveStatusResponse,
  TripResponse,
  UserSummary,
} from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import type { SaveTarget } from '@/lib/engagement-cache';

const postPath = (id: string) => `/api/posts/${encodeURIComponent(id)}`;
const tripPath = (id: string) => `/api/trips/${encodeURIComponent(id)}`;
const savePath = (target: SaveTarget, id: string) =>
  `${target === 'post' ? postPath(id) : tripPath(id)}/save`;

export const likePost = withMock<[id: string], LikeStatusResponse>({
  live: true,
  real: (id) => apiRequest('POST', `${postPath(id)}/like`),
  mock: (id) => mockSetLike(id, true),
});

export const unlikePost = withMock<[id: string], LikeStatusResponse>({
  live: true,
  real: (id) => apiRequest('DELETE', `${postPath(id)}/like`),
  mock: (id) => mockSetLike(id, false),
});

/** Who liked the post, most recent first. */
export const listPostLikes = withMock<
  [id: string, cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<PostLikerResponse>
>({
  live: true,
  real: (id, cursor, signal) => apiGet(`${postPath(id)}/likes`, { cursor, limit: 20 }, { signal }),
  mock: async (id, cursor) => {
    await mockDelay();
    const post = mockFindPost(id);
    return mockPage(mockLikers(post), cursor);
  },
});

export const saveItem = withMock<[target: SaveTarget, id: string], SaveStatusResponse>({
  live: true,
  real: (target, id) => apiRequest('POST', savePath(target, id)),
  mock: (target, id) => mockSetSave(target, id, true),
});

export const unsaveItem = withMock<[target: SaveTarget, id: string], SaveStatusResponse>({
  live: true,
  real: (target, id) => apiRequest('DELETE', savePath(target, id)),
  mock: (target, id) => mockSetSave(target, id, false),
});

/** Your saved trips, most recently saved first. There's no way to ask for anyone else's. */
export const listSavedTrips = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<TripResponse>
>({
  live: true,
  real: (cursor, signal) => apiGet('/api/me/saved/trips', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    return mockPage(mockTrips.filter((trip) => mockSaved.has(`trip:${trip.id}`)).map((trip) => ({ ...trip })), cursor);
  },
});

/** Your saved posts, most recently saved first. */
export const listSavedPosts = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<PostResponse>
>({
  live: true,
  real: (cursor, signal) => apiGet('/api/me/saved/posts', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    return mockPage(mockPosts.filter((post) => mockSaved.has(`post:${post.id}`)).map((post) => ({ ...post })), cursor);
  },
});

// Follow buttons on the likes list. FOL-1's routes are served under /api/api
// until #103 merges, so these 404 against a local API before then.

export const followUser = withMock<[id: string], void>({
  live: true,
  real: async (id) => {
    await apiRequest('POST', `/api/users/${encodeURIComponent(id)}/follow`);
  },
  mock: async () => {
    await mockDelay();
  },
});

export const unfollowUser = withMock<[id: string], void>({
  live: true,
  real: async (id) => {
    await apiRequest('DELETE', `/api/users/${encodeURIComponent(id)}/follow`);
  },
  mock: async () => {
    await mockDelay();
  },
});

// Mock data: a few of Maya's Lisbon posts and trips, with the mock user's saves in memory

const maya: UserSummary = { id: 'mock-maya', username: 'maya.chen', firstName: 'Maya', lastName: 'Chen', avatarUrl: null };
const people: UserSummary[] = ['Priya Shah', 'Noah Okafor', 'Sofia Silva', 'Kenji Tanaka', 'Amara Haddad'].map(
  (name, i) => {
    const [firstName, lastName] = name.split(' ');
    return { id: `mock-liker-${i + 1}`, username: name.toLowerCase().replace(' ', '.'), firstName, lastName, avatarUrl: null };
  },
);

const mockTrips: TripResponse[] = [
  ['Lisbon in four days', 'Lisbon, Portugal', '2026-09-10', '2026-09-13'],
  ['Sintra day trip', 'Sintra, Portugal', '2026-09-14', '2026-09-14'],
].map(([title, destination, startDate, endDate], i) => ({
  id: `mock-trip-${i + 1}`,
  owner: maya,
  title,
  destination,
  description: null,
  startDate,
  endDate,
  status: 'published',
  publishedAt: `${endDate}T18:00:00.000Z`,
  postCount: 3,
  coverImageUrl: null,
  saveCount: 4 + i,
  savedByMe: true,
  createdAt: `${startDate}T09:00:00.000Z`,
  updatedAt: `${endDate}T18:00:00.000Z`,
}));

const mockPosts: PostResponse[] = [
  ['Belém Tower', 'Got here right at opening. Worth the early start!'],
  ['Time Out Market', 'Two rounds of pastéis de nata. No regrets.'],
  ['Miradouro da Senhora do Monte', 'Best sunset in the city.'],
].map(([place, caption], i) => ({
  id: `mock-post-${i + 1}`,
  tripId: mockTrips[0].id,
  author: maya,
  caption,
  visitedOn: `2026-09-1${i}`,
  location: null,
  customLocationName: `${place}, Lisbon`,
  rating: null,
  media: [],
  likeCount: 3 + i,
  saveCount: 1,
  commentCount: 0,
  likedByMe: false,
  savedByMe: true,
  createdAt: `2026-09-1${i}T18:00:00.000Z`,
  updatedAt: `2026-09-1${i}T18:00:00.000Z`,
}));

const mockSaved = new Set([...mockTrips.map((trip) => `trip:${trip.id}`), ...mockPosts.map((post) => `post:${post.id}`)]);
const mockLiked = new Set<string>();

function mockFindPost(id: string): PostResponse {
  return mockPosts.find((post) => post.id === id) ?? mockError(404, 'Post not found', postPath(id));
}

function mockLikers(post: PostResponse): PostLikerResponse[] {
  return people.slice(0, post.likeCount).map((person, i) => ({
    ...person,
    isFollowing: i % 2 === 0,
    likedAt: new Date(Date.parse(post.createdAt) + (people.length - i) * 3_600_000).toISOString(),
  }));
}

async function mockSetLike(id: string, liked: boolean): Promise<LikeStatusResponse> {
  await mockDelay();
  const post = mockFindPost(id);
  if (mockLiked.has(id) !== liked) {
    if (liked) mockLiked.add(id);
    else mockLiked.delete(id);
    post.likeCount += liked ? 1 : -1;
    post.likedByMe = liked;
  }
  return { liked, likeCount: post.likeCount };
}

async function mockSetSave(target: SaveTarget, id: string, saved: boolean): Promise<SaveStatusResponse> {
  await mockDelay();
  const item: PostResponse | TripResponse =
    target === 'post'
      ? mockFindPost(id)
      : (mockTrips.find((trip) => trip.id === id) ?? mockError(404, 'Trip not found', tripPath(id)));
  const key = `${target}:${id}`;
  if (mockSaved.has(key) !== saved) {
    if (saved) mockSaved.add(key);
    else mockSaved.delete(key);
    item.saveCount += saved ? 1 : -1;
    item.savedByMe = saved;
  }
  return { saved, saveCount: item.saveCount };
}
