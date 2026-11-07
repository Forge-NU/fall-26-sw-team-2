import type { LocationRating, PostResponse, TripResponse } from "./content.js";
import type { PaginatedResponse, UserResponse } from "./index.js";

// SRCH-1 result shapes retained; SRCH-3 adds trips, posts and filters.
export type SearchType = "people" | "places" | "trips" | "posts";
export type SearchSort = "relevance" | "newest";
export interface SearchRequest {
  q: string;
  type?: SearchType;
  from?: string;
  to?: string;
  minRating?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: SearchSort;
  cursor?: string;
  limit?: number;
}
export type PersonSearchResult = UserResponse & { isFollowing: boolean };
export type PlaceRating = LocationRating;
export type PlaceSearchResult = {
  id: string;
  name: string;
  coordinate: { latitude: number; longitude: number };
  city: string | null;
  region: string | null;
  countryCode: string | null;
  postCount: number;
  rating: PlaceRating | null;
};
export type SearchPerson = PersonSearchResult;
export type SearchPlace = PlaceSearchResult;
export interface SearchItems {
  people: PersonSearchResult;
  places: PlaceSearchResult;
  trips: TripResponse;
  posts: PostResponse;
}
export type SearchPreview = { [K in SearchType]: SearchItems[K][] };
export type SearchPage<K extends SearchType = SearchType> = PaginatedResponse<
  SearchItems[K]
> & { type: K };
export type SearchResponse = SearchPreview | SearchPage;
