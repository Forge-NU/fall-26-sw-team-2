import type { CreatePostRequest, PaginatedResponse, PostResponse, UpdatePostRequest } from 'shared-types';

import { apiRequest } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockCreatePost, mockGetTripPosts, mockUpdatePost } from '@/api/mock-backend';

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

// Owner edits, for post detail (#43 POST-3). To remove the location, send
// { locationId: null, customLocationName: null } (#143 POST-4).
export const updatePost = withMock({
  live: true,
  real: (id: string, body: UpdatePostRequest) =>
    apiRequest<PostResponse>('PATCH', `/api/posts/${encodeURIComponent(id)}`, body),
  mock: mockUpdatePost,
});
