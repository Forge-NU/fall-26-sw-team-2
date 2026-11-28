import type { PaginatedResponse } from "./index.js";
import type { PostResponse, TripResponse } from "./content.js";

// Home feed (#26 FEED-1). See docs/architecture/feed.md.

/**
 * The feed tabs GET /api/feed accepts. `friends` is the MVP feed; `local` is
 * post-MVP and returns an empty page for now. FYP has its own endpoint (#118).
 */
export type FeedType = "friends" | "local";

/** One trip card in the feed */
export type FeedItem = {
  trip: TripResponse;
  /**
   * Only the posts the card's day previews use, in trip order: for each day,
   * the first post with a location and the first with an image (often the
   * same post), or the day's first post if it has neither. Not every post:
   * `trip.postCount` is the real total, and GET /api/trips/:id/posts pages
   * through them all. See "Which posts a card gets" in docs/architecture/feed.md.
   */
  posts: PostResponse[];
};

/** GET /api/feed?type=friends&cursor=&limit= */
export type FeedResponse = PaginatedResponse<FeedItem>;
