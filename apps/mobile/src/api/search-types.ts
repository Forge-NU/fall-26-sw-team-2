// COPIED from #113 (SRCH-3) apps/shared-types/src/search.ts, which isn't merged yet.
// Once #113 merges, import these from 'shared-types' instead and delete this file.
import type { LocationResponse, PaginatedResponse, PostResponse, TripResponse, UserResponse } from 'shared-types';

export type SearchType = 'people' | 'places' | 'trips' | 'posts';
export type SearchSort = 'relevance' | 'newest';
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
export type SearchPage<K extends SearchType = SearchType> = PaginatedResponse<SearchItems[K]>;
export type SearchResponse = SearchPreview | SearchPage;
