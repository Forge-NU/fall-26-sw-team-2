// Shared types for the feed ranking pipeline:
//   sources -> hydrators -> filters -> scorer -> reranker -> page
// Each stage is an interface so data ingest can be swapped without touching the pipeline.

// Every signal is normalized to [0, 1] by whoever sets it. Add new signals here and give
// them a weight in the feed config; the scorer treats a missing signal as 0.
export const FEED_SIGNALS = [
  'recency',
  'engagement',
  'quality',
  'tasteMatch',
  'community',
] as const;

export type FeedSignal = (typeof FEED_SIGNALS)[number];

export type FeedSignals = Partial<Record<FeedSignal, number>>;

export interface ViewerContext {
  // null until auth exists, or for signed-out viewers.
  viewerId: string | null;
  now: Date;
}

export interface FeedCandidate {
  itineraryId: string;
  authorId: string;
  createdAt: Date;
  // Names of every source that returned this itinerary.
  sources: string[];
  signals: FeedSignals;
}

// What a source returns; the pipeline fills in `sources`.
export type SourcedCandidate = Omit<FeedCandidate, 'sources'>;

export interface ScoredCandidate extends FeedCandidate {
  score: number;
}

// Retrieval: pulls a pool of itineraries that might be worth showing (e.g. popular,
// matches viewer taste, from viewer's school). Sources may prefill signals they know.
export interface CandidateSource {
  readonly name: string;
  fetch(viewer: ViewerContext, limit: number): Promise<SourcedCandidate[]>;
}

// Ingest: attaches signals to candidates. Should not add or drop candidates.
export interface SignalHydrator {
  readonly name: string;
  hydrate(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]>;
}

// Removes candidates the viewer must not see (own posts, blocked authors, already seen).
export interface CandidateFilter {
  readonly name: string;
  apply(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]>;
}

export interface CandidateScorer {
  score(candidate: FeedCandidate, viewer: ViewerContext): number;
}

// Reorders the score-sorted list (e.g. for diversity). Must not add or drop candidates.
export interface FeedReranker {
  rerank(
    ranked: readonly ScoredCandidate[],
    viewer: ViewerContext,
  ): ScoredCandidate[];
}

export interface FeedItem {
  itineraryId: string;
  authorId: string;
  score: number;
  sources: string[];
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}
