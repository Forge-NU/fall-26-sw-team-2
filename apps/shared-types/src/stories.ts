import type { PaginatedResponse, UserSummary } from './index.js';
import type { LocationResponse } from './locations.js';

// Story contracts (docs/architecture/stories.md).

export type StoryResponse = {
  id: string;
  owner: UserSummary;
  tripId: string | null;
  text: string | null;
  location: LocationResponse | null;
  customLocationName: string | null;
  imageUrl: string;
  keepOnTrip: boolean;
  /** YYYY-MM-DD, the day the story is from */
  storyDate: string;
  expiresAt: string;
  createdAt: string;
};

/** One user's active stories in the stories bar, oldest first */
export type StoryGroup = {
  owner: UserSummary;
  stories: StoryResponse[];
};

/** GET /api/stories/feed: users with active stories, newest story first */
export type StoriesFeedResponse = PaginatedResponse<StoryGroup>;

/** GET /api/trips/:id/stories: stories kept on the trip, by story date */
export type TripStoriesResponse = PaginatedResponse<StoryResponse>;

/**
 * Body of POST /api/stories. At most one of locationId and
 * customLocationName, and keepOnTrip only with a tripId.
 */
export type CreateStoryRequest = {
  s3Key: string;
  tripId?: string;
  keepOnTrip?: boolean;
  /** Up to 200 characters */
  text?: string | null;
  locationId?: string;
  /** 1-100 characters */
  customLocationName?: string;
  /** The user's local today, for the active-trip check */
  date?: string;
  /** Any day of the trip; today without a trip (the default) */
  storyDate?: string;
};
