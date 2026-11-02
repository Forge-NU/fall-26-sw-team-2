import { ApiError, apiRequest, USE_MOCK_API } from '@/api/client';
import { mockResolveLocation, mockRetrievePlace, mockSearchPlaces } from '@/api/mocks';
import type {
  PlaceSuggestion,
  ResolveLocationRequest,
  ResolveLocationResponse,
} from '@/api/types';

// Public token, bundled into the app. Search falls back to mock places without it.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const SEARCH_BOX_URL = 'https://api.mapbox.com/search/searchbox/v1';

export const canSearchMapbox = Boolean(MAPBOX_TOKEN) && !USE_MOCK_API;

// Mapbox bills a search session as one /suggest run plus the /retrieve that ends it.
// Not security sensitive, so Math.random is fine.
export function newSearchSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function mapboxGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: MAPBOX_TOKEN ?? '' });
  const response = await fetch(`${SEARCH_BOX_URL}${path}?${query}`);
  if (!response.ok) {
    throw new ApiError(response.status, `Mapbox ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

type SuggestResponse = {
  suggestions: {
    mapbox_id: string;
    name: string;
    place_formatted?: string;
    full_address?: string;
  }[];
};

export async function searchPlaces(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
  if (!canSearchMapbox) return mockSearchPlaces(query);
  const data = await mapboxGet<SuggestResponse>('/suggest', {
    q: query,
    session_token: sessionToken,
    limit: '8',
    language: 'en',
  });
  return data.suggestions.map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name,
    description: s.place_formatted ?? s.full_address ?? null,
  }));
}

type RetrieveResponse = {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      mapbox_id: string;
      name: string;
      full_address?: string;
      address?: string;
      context?: {
        place?: { name?: string };
        region?: { name?: string };
        country?: { country_code?: string };
      };
    };
  }[];
};

// Turns a tapped suggestion into the body /api/locations/resolve expects
export async function retrievePlace(mapboxId: string, sessionToken: string): Promise<ResolveLocationRequest> {
  if (!canSearchMapbox) return mockRetrievePlace(mapboxId);
  const data = await mapboxGet<RetrieveResponse>(`/retrieve/${encodeURIComponent(mapboxId)}`, {
    session_token: sessionToken,
  });
  const feature = data.features[0];
  if (!feature) throw new ApiError(404, 'Place not found');
  const { properties: p, geometry } = feature;
  return {
    kind: 'mapbox',
    mapboxId: p.mapbox_id,
    name: p.name,
    longitude: geometry.coordinates[0],
    latitude: geometry.coordinates[1],
    address: p.full_address ?? p.address ?? null,
    city: p.context?.place?.name ?? null,
    region: p.context?.region?.name ?? null,
    ...(p.context?.country?.country_code && { countryCode: p.context.country.country_code }),
  };
}

// LOC-1 (#62). A custom name comes back unchanged and isn't stored.
export function resolveLocation(body: ResolveLocationRequest): Promise<ResolveLocationResponse> {
  if (USE_MOCK_API) return mockResolveLocation(body);
  return apiRequest('POST', '/api/locations/resolve', body);
}
