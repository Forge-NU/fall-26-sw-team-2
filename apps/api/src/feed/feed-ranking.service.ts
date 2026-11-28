import { PaginationQueryDto } from '../common/pagination';

// One page of the Friends feed, as trip ids in feed order. FeedService turns
// them into cards, so a ranking never builds responses.
export type FeedRankingPage = {
  tripIds: string[];
  nextCursor: string | null;
};

// Decides which trips are in the Friends feed and in what order (#26 FEED-1).
// It's the Nest token too: FeedModule binds it to ChronologicalFeedRanking for
// the MVP, and an algorithmic version (#5) swaps in by changing that one
// provider, with no controller or response-shape changes.
//
// Every implementation must only return published trips (drafts never reach
// the feed) and must page with the cursor helpers in common/pagination.ts.
export abstract class FeedRankingService {
  abstract rank(
    viewerId: string,
    query: PaginationQueryDto,
  ): Promise<FeedRankingPage>;
}
