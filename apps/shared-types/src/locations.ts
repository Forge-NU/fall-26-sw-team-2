// Location contracts (docs/architecture/locations.md).

/** A shared locations row, as returned on posts, stories and POST /api/locations/resolve */
export type LocationResponse = {
  id: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

/** One row of place search results (Mapbox Search Box /suggest) */
export type PlaceSuggestion = {
  mapboxId: string;
  name: string;
  /** e.g. "Sintra, Lisbon, Portugal" */
  description: string | null;
};

/** Body of POST /api/locations/resolve */
export type ResolveLocationRequest =
  | {
      kind: 'mapbox';
      mapboxId: string;
      name: string;
      latitude: number;
      longitude: number;
      address?: string | null;
      city?: string | null;
      region?: string | null;
      countryCode?: string;
    }
  | {
      kind: 'custom';
      name: string;
    };

/**
 * A Mapbox place resolves to a shared locations row. A custom name isn't
 * stored; it goes on the post or story as customLocationName.
 */
export type ResolveLocationResponse =
  | { kind: 'mapbox'; location: LocationResponse }
  | { kind: 'custom'; name: string };
