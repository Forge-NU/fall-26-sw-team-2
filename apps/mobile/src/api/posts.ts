import type { CreatePostRequest, PaginatedResponse, PostResponse } from 'shared-types';

import { apiRequest } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockCreatePost, mockGetTripPosts } from '@/api/mock-backend';

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
