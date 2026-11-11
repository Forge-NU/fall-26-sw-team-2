// GET /api/search (SRCH-3, #113). Without `type` it returns the "All" preview
// (up to 3 of each type); with `type`, one page of that type. The mock in
// search-mock.ts follows the same contract; EXPO_PUBLIC_API_MOCKS=all uses it.
import type { SearchRequest, SearchResponse } from 'shared-types';

import { apiGet } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockSearch } from '@/api/search-mock';
import { hasSearchWords } from '@/lib/search/filters';

/** The API returns nothing for shorter queries, so the app doesn't send them. */
export const MIN_SEARCH_QUERY = 2;

/**
 * True once the query is long enough to search (DOC-1 Use Case 4: under 2
 * characters doesn't run). Counts characters, not UTF-16 units, like the API.
 */
export const isSearchable = hasSearchWords;

export const search = withMock<[SearchRequest, AbortSignal?], SearchResponse>({
  live: true,
  real: (request, signal) => apiGet('/api/search', { ...request }, { signal }),
  mock: mockSearch,
});
