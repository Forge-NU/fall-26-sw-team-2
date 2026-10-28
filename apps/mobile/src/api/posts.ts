import { apiRequest, USE_MOCK_API } from '@/api/client';
import { mockGetTripPosts } from '@/api/mocks';
import type { Page, PostResponse } from '@/api/types';

// Date order, oldest first. Posts on the same date are in the order they were added.
export function getTripPosts(tripId: string, cursor?: string | null): Promise<Page<PostResponse>> {
  if (USE_MOCK_API) return mockGetTripPosts(tripId);
  const query = `?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return apiRequest('GET', `/api/trips/${encodeURIComponent(tripId)}/posts${query}`);
}
