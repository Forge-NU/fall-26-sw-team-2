// Request/response types for the locations API. These live in apps/api until
// API-1 (#28) adds shared-types, then move there unchanged.
// Contract: docs/architecture/locations.md

export type Location = {
  id: string;
  provider: 'mapbox';
  providerPlaceId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

// Body of POST /api/locations/resolve
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

// A Mapbox place resolves to a shared locations row. A custom name isn't
// stored here; it goes on the post as customLocationName.
export type ResolveLocationResponse =
  { kind: 'mapbox'; location: Location } | { kind: 'custom'; name: string };
