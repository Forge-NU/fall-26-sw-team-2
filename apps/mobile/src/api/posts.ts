import type { CreatePostRequest, PaginatedResponse, PostResponse, UpdatePostRequest } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, withMock } from '@/api/mock';
import { mockFindSavedPost } from '@/api/engagement';
import {
  mockCreatePost,
  mockDeletePost,
  mockGetPost,
  mockGetTripPosts,
  mockUpdatePost,
} from '@/api/mock-backend';

// Date order, oldest first. Posts on the same date are in the order they were added.
export const getTripPosts = withMock({
  live: true,
  real: (tripId: string, cursor?: string | null) => {
    const query = `?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    return apiRequest<PaginatedResponse<PostResponse>>(
      'GET',
      `/api/trips/${encodeURIComponent(tripId)}/posts${query}`,
    );
  },
  mock: (tripId: string, _cursor?: string | null) => mockGetTripPosts(tripId),
});

// Only call once every upload has succeeded
export const createPost = withMock({
  live: true,
  real: (body: CreatePostRequest) => apiRequest<PostResponse>('POST', '/api/posts', body),
  mock: mockCreatePost,
});

// A 404 when the post was deleted, or it's in someone else's draft trip
export const getPost = withMock({
  live: true,
  real: (id: string, signal?: AbortSignal) =>
    apiGet<PostResponse>(`/api/posts/${encodeURIComponent(id)}`, undefined, { signal }),
  mock: async (id: string, _signal?: AbortSignal) => {
    const saved = mockFindSavedPost(id);
    if (!saved) return mockGetPost(id);
    await mockDelay();
    return { ...saved };
  },
});

// Trip owner only
export const updatePost = withMock({
  live: true,
  real: (id: string, body: UpdatePostRequest) =>
    apiRequest<PostResponse>('PATCH', `/api/posts/${encodeURIComponent(id)}`, body),
  mock: mockUpdatePost,
});

// Trip owner only. The API deletes the post's media from storage too.
export const deletePost = withMock({
  live: true,
  real: (id: string) => apiRequest<void>('DELETE', `/api/posts/${encodeURIComponent(id)}`),
  mock: mockDeletePost,
});
