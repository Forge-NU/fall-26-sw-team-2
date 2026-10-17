import { apiGet } from '@/api/client';

/**
 * Response of GET /api/feed/fyp (apps/api/src/feed), trimmed to the fields the app
 * uses. Mirrors the API until shared types land (#28).
 */
export type UserSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type TripResponse = {
  id: string;
  owner: UserSummary;
  title: string;
  destination: string;
  description: string | null;
  /** ISO dates (yyyy-mm-dd), inclusive. */
  startDate: string;
  endDate: string;
  publishedAt: string | null;
  postCount: number;
  coverImageUrl: string | null;
};

export type MediaResponse = {
  id: string;
  mediaType: 'image' | 'video';
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type PostResponse = {
  id: string;
  tripId: string;
  caption: string | null;
  /** ISO date (yyyy-mm-dd). */
  visitedOn: string;
  location: { name: string; city: string | null } | null;
  customLocationName: string | null;
  media: MediaResponse[];
};

export type FeedItem = {
  trip: TripResponse;
  /** In trip order: by day, then the order they were added. */
  posts: PostResponse[];
  score: number;
  sources: string[];
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
};

export function fetchFypPage(cursor: string | null, limit: number) {
  return apiGet<FeedPage>('/api/feed/fyp', { cursor: cursor ?? undefined, limit });
}
