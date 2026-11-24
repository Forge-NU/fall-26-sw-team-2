// Saved places for #139 PLACE-2, on #135 PLACE-1's endpoints (contract in
// #131 COLLAB-1, docs/architecture/shared-trips.md). Not built yet, so these
// return mock data. Set `live: true` as PLACE-1 merges.
//
// Place saves are private, so there's no count. Only Mapbox places can be
// saved; a custom location is a 400.
import type { LocationResponse, PaginatedResponse, PlaceSaveStatusResponse, SavedPlaceResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { mockLocation, mockResolvedLocation } from '@/api/mock-backend';

const placeSavePath = (locationId: string) => `/api/locations/${encodeURIComponent(locationId)}/save`;

/** Idempotent. 404 for an unknown place, 400 for a custom location. */
export const savePlace = withMock<[locationId: string], PlaceSaveStatusResponse>({
  live: false, // true once #135 PLACE-1 merges
  real: (locationId) => apiRequest('POST', placeSavePath(locationId)),
  mock: async (locationId) => {
    await mockDelay();
    const location = mockFindPlace(locationId, placeSavePath(locationId));
    if (!saves.has(locationId)) saves.set(locationId, { location, savedAt: new Date().toISOString() });
    return { saved: true };
  },
});

/** Idempotent. 404 for an unknown place. */
export const unsavePlace = withMock<[locationId: string], PlaceSaveStatusResponse>({
  live: false, // true once #135 PLACE-1 merges
  real: (locationId) => apiRequest('DELETE', placeSavePath(locationId)),
  mock: async (locationId) => {
    await mockDelay();
    mockFindPlace(locationId, placeSavePath(locationId));
    saves.delete(locationId);
    return { saved: false };
  },
});

/** Your saved places, newest save first. */
export const listSavedPlaces = withMock<
  [cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<SavedPlaceResponse>
>({
  live: false, // true once #135 PLACE-1 merges
  real: (cursor, signal) => apiGet('/api/me/saved/places', { cursor, limit: 20 }, { signal }),
  mock: async (cursor) => {
    await mockDelay();
    const newestFirst = [...saves.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return mockPage(newestFirst, cursor);
  },
});

// Mock data: a few places around the mock trips, two of them already saved.
// Places picked in mock place search can be saved too.

const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS).toISOString();

/** Places other mocks (the bucket) can use */
export const MOCK_PLACES = {
  timeOut: mockLocation('Time Out Market', 'Lisbon', 38.707019, -9.145949),
  lxFactory: mockLocation('LX Factory', 'Lisbon', 38.703275, -9.178535),
  pena: mockLocation('Pena Palace', 'Sintra', 38.787586, -9.390616),
  quinta: mockLocation('Quinta da Regaleira', 'Sintra', 38.796311, -9.396139),
  lello: mockLocation('Livraria Lello', 'Porto', 41.146861, -8.614889),
};

const saves = new Map<string, SavedPlaceResponse>([
  [MOCK_PLACES.timeOut.id, { location: MOCK_PLACES.timeOut, savedAt: hoursAgo(3) }],
  [MOCK_PLACES.lello.id, { location: MOCK_PLACES.lello, savedAt: hoursAgo(50) }],
]);

/** Whether the mock user saved this place, for the bucket's saved-in mock */
export function mockIsPlaceSaved(locationId: string): boolean {
  return saves.has(locationId);
}

/** A mock place by id, or the API's 404 / 400 */
export function mockFindPlace(locationId: string, path: string): LocationResponse {
  const location =
    Object.values(MOCK_PLACES).find((place) => place.id === locationId) ??
    mockResolvedLocation(locationId) ??
    mockError(404, 'Location not found', path);
  if (location.provider !== 'mapbox') mockError(400, 'Only Mapbox places can be saved', path);
  return location;
}
