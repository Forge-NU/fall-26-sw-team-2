// Location contracts (docs/architecture/locations.md).

/** A place's average star rating, from posts there in published trips */
export type LocationRating = {
  /** Rounded to one decimal */
  average: number;
  count: number;
};

/**
 * 'mapbox': a shared Mapbox place. 'custom': a pin a user dropped (#94
 * LOC-2), which belongs to one post or story.
 */
export type LocationProvider = 'mapbox' | 'custom';

/** A locations row, as returned on posts, stories and POST /api/locations/resolve */
export type LocationResponse = {
  id: string;
  provider: LocationProvider;
  /** The Mapbox id, or a generated id for a custom pin */
  providerPlaceId: string;
  /** For a custom pin, the name the user typed */
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  /** null until a post in a published trip rates the place */
  rating: LocationRating | null;
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
    }
  | {
      /** A dropped pin. Always creates a new row, never reused. */
      kind: 'pin';
      /** 1-100 characters, the same rule as a custom name */
      name: string;
      latitude: number;
      longitude: number;
    };

/**
 * A Mapbox place resolves to a shared locations row, and a dropped pin to a
 * new custom row; either goes on the post or story as locationId. A custom
 * name isn't stored; it goes on the post or story as customLocationName.
 */
export type ResolveLocationResponse =
  | { kind: 'mapbox'; location: LocationResponse }
  | { kind: 'pin'; location: LocationResponse }
  | { kind: 'custom'; name: string };
