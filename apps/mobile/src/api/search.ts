import type { SearchRequest, SearchResponse } from 'shared-types';

import { apiGet } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockSearch } from '@/api/search-mock';

// Switch live on once #93 is merged; EXPO_PUBLIC_API_MOCKS=none can opt into
// the real endpoint for integration testing before then.
export const search = withMock<[SearchRequest, AbortSignal?], SearchResponse>({
  live: false,
  real: (request, signal) => apiGet('/api/search', { ...request }, { signal }),
  mock: mockSearch,
});
