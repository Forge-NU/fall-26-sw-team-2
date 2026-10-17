import type { PostResponse } from '../posts/post.types';
import type { TripResponse } from '../trips/trip.types';

// Shared types for the feed ranking pipeline, modeled on X's For You pipeline
// (https://github.com/xai-org/x-algorithm, see candidate-pipeline/):
//   viewer hydrators -> sources -> candidate hydrators -> filters -> scorers
//   -> selector -> side effects
// Each stage is an interface so data ingest can be swapped without touching the pipeline.

// Actions a viewer can take on a trip in the feed. Scoring predicts the
// probability of each one and combines them with weights (see WeightedActionScorer).
// Add an action here, then give it a prior and a weight in the feed config.
export const FEED_ACTIONS = [
  'open',
  'like',
  'save',
  'addToTrip',
  'share',
  'comment',
  'followAuthor',
  'hide',
  'report',
] as const;

export type FeedAction = (typeof FEED_ACTIONS)[number];

export type ActionCounts = Partial<Record<FeedAction, number>>;

export type ActionProbabilities = Partial<Record<FeedAction, number>>;

// Data about the viewer, loaded once per request by viewer hydrators. A field left
// undefined means it wasn't loaded. Filters that rely on one for safety (e.g. blocked
// authors) should throw when it's missing rather than let content through.
export interface ViewerData {
  // Trips already served earlier in this feed session.
  servedTripIds?: ReadonlySet<string>;
  // TODO(ingest): followed authors, blocked authors, saved trips, school, etc.
}

export interface ViewerContext extends ViewerData {
  // null until auth exists, or for signed-out viewers.
  viewerId: string | null;
  // One scroll through the feed, carried between pages in the cursor.
  sessionId: string;
  now: Date;
}

export interface EngagementStats {
  impressions: number;
  actions: ActionCounts;
}

export interface FeedCandidate {
  tripId: string;
  authorId: string;
  publishedAt: Date;
  // Names of every source that returned this trip.
  sources: string[];
  // Filled in by sources or candidate hydrators; undefined means not loaded.
  stats?: EngagementStats;
  // Impressions across all of the author's trips, for the new-author slot.
  authorImpressions?: number;
  // Set by the scorers.
  predictions: ActionProbabilities;
  score: number;
}

// What a source returns; the pipeline fills in the rest.
export type SourcedCandidate = Omit<
  FeedCandidate,
  'sources' | 'predictions' | 'score'
>;

// Loads data about the viewer (X: QueryHydrator). Runs in parallel with the other
// viewer hydrators; the fields returned are merged into the viewer context.
export interface ViewerHydrator {
  readonly name: string;
  hydrate(viewer: ViewerContext): Promise<ViewerData>;
}

// Retrieval: pulls a pool of trips that might be worth showing (X: Source),
// e.g. popular, same school, matches the viewer's taste.
export interface CandidateSource {
  readonly name: string;
  fetch(viewer: ViewerContext, limit: number): Promise<SourcedCandidate[]>;
}

// Loads data onto candidates, e.g. engagement stats (X: Hydrator). Must return the
// same number of candidates; otherwise its output is discarded.
export interface CandidateHydrator {
  readonly name: string;
  hydrate(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]>;
}

// Removes candidates the viewer must not see (X: Filter).
export interface CandidateFilter {
  readonly name: string;
  apply(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]>;
}

// Sets predictions or adjusts scores (X: Scorer). Scorers run in order, each on the
// previous one's output. Must return the same number of candidates; otherwise its
// output is discarded.
export interface CandidateScorer {
  readonly name: string;
  score(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]>;
}

// Picks and orders the page (X: Selector).
export interface CandidateSelector {
  select(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
    size: number,
  ): FeedCandidate[];
}

// Runs once the page is chosen, e.g. recording what was served (X: SideEffect).
export interface FeedSideEffect {
  readonly name: string;
  run(viewer: ViewerContext, served: readonly FeedCandidate[]): Promise<void>;
}

// What the app needs to draw a trip card.
export interface TripCard {
  trip: TripResponse;
  posts: PostResponse[];
}

// Loads cards for the selected page only, so posts and media aren't loaded for
// candidates that weren't picked (X: post-selection hydrators). Trips that no longer
// exist are left out of the result.
export interface FeedCardLoader {
  load(tripIds: readonly string[]): Promise<Map<string, TripCard>>;
}

export interface FeedItem extends TripCard {
  score: number;
  sources: string[];
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}
