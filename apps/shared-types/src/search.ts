import type { PostResponse, TripResponse } from "./content.js";
import type { LocationResponse } from "./locations.js";
import type { PaginatedResponse, UserResponse } from "./index.js";

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
export type SearchPerson = UserResponse & { isFollowing: boolean };
export type SearchPlace = LocationResponse & {
  postCount: number;
};
export interface SearchItems {
  people: SearchPerson;
  places: SearchPlace;
  trips: TripResponse;
  posts: PostResponse;
}
export type SearchPreview = { [K in SearchType]: SearchItems[K][] };
export type SearchPage<K extends SearchType = SearchType> = PaginatedResponse<
  SearchItems[K]
>;
export type SearchResponse = SearchPreview | SearchPage;
