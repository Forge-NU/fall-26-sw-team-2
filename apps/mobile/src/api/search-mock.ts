import type { SearchItems, SearchPreview, SearchRequest, SearchResponse, SearchType } from 'shared-types';

import { mockSearchPeople } from '@/api/profiles';
import { MOCK_LATENCY_MS } from '@/api/mock';
import { createSearchFixtures } from '@/api/search-fixtures';

const TYPES: SearchType[] = ['people', 'places', 'trips', 'posts'];

export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      const error = new Error('Search cancelled');
      error.name = 'AbortError';
      reject(error);
    };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

function distanceKm(a: { latitude: number; longitude: number }, lat: number, lng: number) {
  const rad = Math.PI / 180;
  const dLat = (a.latitude - lat) * rad;
  const dLng = (a.longitude - lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function createSearchMock(data: SearchPreview = createSearchFixtures(), latency = MOCK_LATENCY_MS) {
  return async (request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> => {
    await abortableDelay(latency, signal);
    const q = request.q.trim().replace(/\s+/g, ' ').toLowerCase();
    const words = q.split(' ').filter(word => [...word].length >= 2);
    const matches = (text: string) => words.length > 0 && words.every(word => text.toLowerCase().includes(word));
    const within = (point: { latitude: number; longitude: number } | null) => request.radiusKm === undefined
      || (point !== null && request.lat !== undefined && request.lng !== undefined
        && distanceKm(point, request.lat, request.lng) <= request.radiusKm);
    const placeRating = (id: string | undefined) => data.places.find(place => place.id === id)?.rating;
    const rated = (id: string | undefined) => request.minRating === undefined
      || (placeRating(id)?.average ?? 0) >= request.minRating;
    const filtered: SearchPreview = {
      people: data.people.filter(person => matches(`${person.username ?? ''} ${person.firstName} ${person.lastName}`)),
      places: data.places.filter(place => matches(`${place.name} ${place.city ?? ''} ${place.region ?? ''}`)
        && rated(place.id) && within(place)),
      trips: data.trips.filter(trip => trip.status === 'published' && matches(`${trip.title} ${trip.destination} ${trip.description ?? ''}`)
        && (!request.from || trip.endDate >= request.from) && (!request.to || trip.startDate <= request.to)
        && (request.radiusKm === undefined || data.posts.some(post => post.tripId === trip.id && within(post.location)))),
      posts: data.posts.filter(post => data.trips.some(trip => trip.id === post.tripId && trip.status === 'published')
        && matches(`${post.caption ?? ''} ${post.customLocationName ?? ''} ${post.location?.name ?? ''}`)
        && (!request.from || post.visitedOn >= request.from) && (!request.to || post.visitedOn <= request.to)
        && rated(post.location?.id) && within(post.location)),
    };
    for (const type of TYPES) {
      // Newest uses the API's timestamp fields. A stable ID tie-breaker keeps
      // page boundaries deterministic; relevance fixtures retain seed order.
      const timestamp = (item: SearchItems[SearchType]) => 'createdAt' in item ? item.createdAt : item.id;
      filtered[type].sort((a, b) => request.sort === 'newest'
        ? timestamp(b).localeCompare(timestamp(a)) || b.id.localeCompare(a.id) : 0);
    }
    if (!request.type) return {
      people: filtered.people.slice(0, 3), places: filtered.places.slice(0, 3),
      trips: filtered.trips.slice(0, 3), posts: filtered.posts.slice(0, 3),
    };
    const scope = JSON.stringify({ ...request, q, cursor: undefined, limit: undefined });
    let start = 0;
    if (request.cursor) {
      const cursor = JSON.parse(decodeURIComponent(request.cursor)) as { scope: string; offset: number };
      if (cursor.scope !== scope || !Number.isSafeInteger(cursor.offset) || cursor.offset < 0) throw new Error('Invalid search cursor');
      start = cursor.offset;
    }
    const limit = Math.min(50, Math.max(1, request.limit ?? 20));
    const items = filtered[request.type];
    const end = start + limit;
    return {
      items: items.slice(start, end),
      nextCursor: end < items.length ? encodeURIComponent(JSON.stringify({ scope, offset: end })) : null,
    };
  };
}

export const mockSearch = (request: SearchRequest, signal?: AbortSignal) => {
  const fixtures = createSearchFixtures();
  fixtures.people = mockSearchPeople('');
  fixtures.trips.forEach((trip, index) => { trip.owner = fixtures.people[index % fixtures.people.length]; });
  fixtures.posts.forEach((post, index) => { post.author = fixtures.trips[index].owner; });
  return createSearchMock(fixtures)(request, signal);
};
