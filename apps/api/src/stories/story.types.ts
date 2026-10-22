import { Page } from '../common/pagination';
import { UserSummary } from '../common/user-summary';
import { LocationResponse } from '../posts/post.types';

// Response shapes for the story endpoints (docs/architecture/stories.md).
// Moves to shared-types with API-1 (#28).

export type StoryResponse = {
  id: string;
  owner: UserSummary;
  tripId: string | null;
  text: string | null;
  location: LocationResponse | null;
  customLocationName: string | null;
  imageUrl: string;
  keepOnTrip: boolean;
  storyDate: string; // YYYY-MM-DD, the day the story is from
  expiresAt: string;
  createdAt: string;
};

// One user's active stories in the stories bar, oldest first
export type StoryGroup = {
  owner: UserSummary;
  stories: StoryResponse[];
};

// GET /api/stories/feed: users with active stories, newest story first
export type StoriesFeedResponse = Page<StoryGroup>;

// GET /api/trips/:id/stories: stories kept on the trip, by story date
export type TripStoriesResponse = Page<StoryResponse>;
