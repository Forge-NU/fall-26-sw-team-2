// STAND-IN for API-1 (#28): delete once shared-types exists.
// Copied from #61 (stories) and #56 (trips), keep in sync until then.

export type UserSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// Trips (#56)

export type TripStatus = 'draft' | 'published';

export type TripResponse = {
  id: string;
  owner: UserSummary;
  title: string;
  destination: string;
  description: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: TripStatus;
  publishedAt: string | null;
  postCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

// GET /api/me/trips/active?date=YYYY-MM-DD
export type ActiveTripsResponse = {
  items: TripResponse[];
};

// POST /api/trips
export type CreateTripRequest = {
  title: string; // 1-100 characters
  destination: string; // 1-100 characters
  description?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

// Stories (#61)

export type StoryLocationResponse = {
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

export type StoryResponse = {
  id: string;
  owner: UserSummary;
  tripId: string | null;
  text: string | null;
  location: StoryLocationResponse | null;
  customLocationName: string | null;
  imageUrl: string;
  keepOnTrip: boolean;
  expiresAt: string;
  createdAt: string;
};

// POST /api/stories. At most one of locationId and customLocationName, and
// keepOnTrip only with a tripId.
export type CreateStoryRequest = {
  s3Key: string;
  tripId?: string;
  keepOnTrip?: boolean;
  text?: string | null; // up to 200 characters
  locationId?: string;
  customLocationName?: string; // 1-100 characters
  date?: string; // user's local today, for the active-trip check
};

// Uploads: guessed until MEDIA-1 (#38) defines the endpoint

export type UploadPurpose = 'story';

export type CreateUploadRequest = {
  purpose: UploadPurpose;
  contentType: 'image/jpeg';
};

export type CreateUploadResponse = {
  uploadUrl: string; // presigned S3 PUT URL
  s3Key: string;
};

// Copied as-is from #65 (POST-2) so the story composer can use its location
// picker once it merges

export type LocationResponse = StoryLocationResponse;

// Locations (#62, LOC-1)

// One row of place search results (Mapbox Search Box /suggest)
export type PlaceSuggestion = {
  mapboxId: string;
  name: string;
  description: string | null; // e.g. "Sintra, Lisbon, Portugal"
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
  | { kind: 'custom'; name: string };

// A Mapbox place resolves to a shared locations row. A custom name isn't
// stored; it goes on the post or story as customLocationName.
export type ResolveLocationResponse =
  | { kind: 'mapbox'; location: LocationResponse }
  | { kind: 'custom'; name: string };
