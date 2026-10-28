// Search contracts (SRCH-1). One endpoint, so SRCH-3 can add trips, posts
// and filters as more `type`s.
// Contract: docs/architecture/search.md

export type SearchType = "people" | "places";

/** GET /api/search query. `q` with no word of 2+ characters returns an empty page. */
export type SearchRequest = {
  type: SearchType;
  q?: string;
  cursor?: string;
  /** 1 to 50, default 20 */
  limit?: number;
};

/** A user, with whether the viewer follows them (same shape as follow lists) */
export type PersonSearchResult = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
};

export type PlaceRating = {
  /** Out of 5 */
  average: number;
  count: number;
};

/**
 * A location with posts in published trips. `id`, `name` and `coordinate`
 * match the Explore tab's mock `Place` (MAP-1), so the map can show it.
 */
export type PlaceSearchResult = {
  /** The location id, the same one posts reference */
  id: string;
  name: string;
  /** Same shape as MAP-1's LatLng */
  coordinate: { latitude: number; longitude: number };
  city: string | null;
  region: string | null;
  countryCode: string | null;
  /** Posts here in published trips */
  postCount: number;
  /** Always null until post ratings (RATE-1) land */
  rating: PlaceRating | null;
};

/** GET /api/search. `type` matches the request, and says which results these are. */
export type SearchResponse =
  | { type: "people"; items: PersonSearchResult[]; nextCursor: string | null }
  | { type: "places"; items: PlaceSearchResult[]; nextCursor: string | null };
