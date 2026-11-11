// GET /api/search (SRCH-3, #113). Not merged yet, so this returns mock data until
// it is: set live to true once #113 is on main.
import { apiGet } from '@/api/client';
import { mockDelay, mockPage, withMock } from '@/api/mock';
import { mockSearchPeople } from '@/api/profiles';
import type { SearchItems, SearchPage, SearchPlace } from 'shared-types';
import { AREA_BY_ID, COUNTRY_BY_ID, PLACES } from '@/components/explore/mock-data';
import { normalizeSearchText } from '@/utils/search-text';

/** The API returns nothing for shorter queries, so the app doesn't send them. */
export const MIN_SEARCH_QUERY = 2;

/**
 * True once the query is long enough to search (DOC-1 Use Case 4: under 2
 * characters doesn't run). Counts characters, not UTF-16 units, like the API.
 */
export const isSearchable = (query: string) => [...query.trim()].length >= MIN_SEARCH_QUERY;

/** People or places for SRCH-2. Trips, posts and the filters come with SRCH-4 (#96). */
export type SearchKind = 'people' | 'places';

export type SearchArgs<K extends SearchKind> = [
  type: K,
  q: string,
  cursor: string | null,
  signal?: AbortSignal,
];

export const searchByType = withMock<SearchArgs<SearchKind>, SearchPage<SearchKind>>({
  live: false,
  real: (type, q, cursor, signal) => apiGet('/api/search', { q, type, cursor, limit: 20 }, { signal }),
  mock: async (type, q, cursor) => {
    await mockDelay();
    if (!isSearchable(q)) return { items: [], nextCursor: null };
    const items = type === 'people' ? mockSearchPeople(q) : mockSearchPlaces(q);
    return mockPage<SearchItems[SearchKind]>(items, cursor);
  },
});

/** Typed wrapper, so callers get people or places back rather than the union. */
export function search<K extends SearchKind>(...[type, q, cursor, signal]: SearchArgs<K>): Promise<SearchPage<K>> {
  return searchByType(type, q, cursor, signal) as Promise<SearchPage<K>>;
}

// Mock places are the Map tab's mock places (same ids), so tapping one opens its
// place sheet until MAP-3 (#47) brings real map data.
function mockSearchPlaces(q: string): SearchPlace[] {
  const query = normalizeSearchText(q);
  return PLACES.filter((place) => {
    const area = AREA_BY_ID[place.areaId];
    return [place.name, place.type, place.neighborhood, area.name, COUNTRY_BY_ID[area.countryId].name].some(
      (field) => normalizeSearchText(field).includes(query),
    );
  }).map((place) => {
    const area = AREA_BY_ID[place.areaId];
    const { rating, reviews, logs } = place.stats.global;
    return {
      id: place.id,
      provider: 'mock',
      providerPlaceId: place.id,
      name: place.name,
      address: place.neighborhood,
      latitude: place.coordinate.latitude,
      longitude: place.coordinate.longitude,
      city: area.name,
      region: COUNTRY_BY_ID[area.countryId].name,
      countryCode: area.countryId.toUpperCase(),
      rating: reviews > 0 ? { average: rating, count: reviews } : null,
      postCount: logs,
    };
  });
}
