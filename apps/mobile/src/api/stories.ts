import type { CreateStoryRequest, StoriesFeedResponse, StoryResponse, TripStoriesResponse } from 'shared-types';

import { apiRequest } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockCreateStory, mockDeleteStory, mockGetStoriesFeed, mockGetTripStories } from '@/api/mock-backend';

export const createStory = withMock({
  live: true,
  real: (body: CreateStoryRequest) => apiRequest<StoryResponse>('POST', '/api/stories', body),
  mock: mockCreateStory,
});

// The stories bar: the viewer and the users they follow with active stories. Pages through users.
export const getStoriesFeed = withMock({
  live: true,
  real: (cursor?: string | null) => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return apiRequest<StoriesFeedResponse>('GET', `/api/stories/feed${query}`);
  },
  mock: (_cursor?: string | null) => mockGetStoriesFeed(),
});

// Stories kept on a trip ("Add to trip"), including expired ones, by story date
export const getTripStories = withMock({
  live: true,
  real: (tripId: string, cursor?: string | null) => {
    const query = `?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    return apiRequest<TripStoriesResponse>('GET', `/api/trips/${encodeURIComponent(tripId)}/stories${query}`);
  },
  mock: (tripId: string, _cursor?: string | null) => mockGetTripStories(tripId),
});

export const deleteStory = withMock({
  live: true,
  real: (id: string) => apiRequest<void>('DELETE', `/api/stories/${encodeURIComponent(id)}`),
  mock: mockDeleteStory,
});
