import { Inject, Injectable, Logger } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '../feed-cursor';
import type {
  CandidateFilter,
  CandidateScorer,
  CandidateSource,
  FeedCandidate,
  FeedPage,
  FeedReranker,
  ScoredCandidate,
  SignalHydrator,
  ViewerContext,
} from '../feed.types';
import {
  FOR_YOU_CONFIG,
  FOR_YOU_FILTERS,
  FOR_YOU_HYDRATORS,
  FOR_YOU_RERANKER,
  FOR_YOU_SCORER,
  FOR_YOU_SOURCES,
  type ForYouConfig,
} from './for-you.config';

export interface FeedPageRequest {
  cursor?: string;
  limit?: number;
}

// Highest score first; ties go to the newer itinerary, then by id so order is stable.
function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  return (
    b.score - a.score ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    a.itineraryId.localeCompare(b.itineraryId)
  );
}

@Injectable()
export class ForYouFeedService {
  private readonly logger = new Logger(ForYouFeedService.name);

  constructor(
    @Inject(FOR_YOU_CONFIG) private readonly config: ForYouConfig,
    @Inject(FOR_YOU_SOURCES) private readonly sources: CandidateSource[],
    @Inject(FOR_YOU_HYDRATORS) private readonly hydrators: SignalHydrator[],
    @Inject(FOR_YOU_FILTERS) private readonly filters: CandidateFilter[],
    @Inject(FOR_YOU_SCORER) private readonly scorer: CandidateScorer,
    @Inject(FOR_YOU_RERANKER) private readonly reranker: FeedReranker,
  ) {}

  // Ranks from scratch on every request, so items can shift between pages if signals
  // change mid-scroll. If that becomes a problem, cache the ranked list per viewer.
  async getPage(
    viewer: ViewerContext,
    request: FeedPageRequest = {},
  ): Promise<FeedPage> {
    const limit = Math.min(
      Math.max(request.limit ?? this.config.defaultPageSize, 1),
      this.config.maxPageSize,
    );
    const offset = request.cursor ? decodeCursor(request.cursor) : 0;

    const ranked = await this.rank(viewer);
    const page = ranked.slice(offset, offset + limit);
    const nextOffset = offset + page.length;

    return {
      items: page.map(({ itineraryId, authorId, score, sources }) => ({
        itineraryId,
        authorId,
        score,
        sources,
      })),
      nextCursor: nextOffset < ranked.length ? encodeCursor(nextOffset) : null,
    };
  }

  async rank(viewer: ViewerContext): Promise<ScoredCandidate[]> {
    let candidates = await this.retrieve(viewer);
    candidates = await this.hydrate(candidates, viewer);

    // Filters are not caught: if one fails we error rather than show something the
    // viewer shouldn't see.
    for (const filter of this.filters) {
      candidates = await filter.apply(candidates, viewer);
    }

    const scored = candidates
      .map((candidate) => ({
        ...candidate,
        score: this.scorer.score(candidate, viewer),
      }))
      .sort(compareScored);

    return this.reranker.rerank(scored, viewer);
  }

  // A failing source shouldn't empty the feed, so drop it and keep the rest.
  // Itineraries returned by several sources are merged; earlier sources win on signals.
  private async retrieve(viewer: ViewerContext): Promise<FeedCandidate[]> {
    const results = await Promise.allSettled(
      this.sources.map((source) =>
        source.fetch(viewer, this.config.candidatesPerSource),
      ),
    );

    const byId = new Map<string, FeedCandidate>();
    results.forEach((result, index) => {
      const sourceName = this.sources[index].name;
      if (result.status === 'rejected') {
        this.logger.warn(
          `Candidate source "${sourceName}" failed: ${String(result.reason)}`,
        );
        return;
      }
      for (const candidate of result.value) {
        const existing = byId.get(candidate.itineraryId);
        if (existing) {
          existing.sources.push(sourceName);
          existing.signals = { ...candidate.signals, ...existing.signals };
        } else {
          byId.set(candidate.itineraryId, {
            ...candidate,
            sources: [sourceName],
          });
        }
      }
    });

    return [...byId.values()];
  }

  // Hydrators fail open: a signal that never gets set just scores 0.
  private async hydrate(
    candidates: FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    let hydrated = candidates;
    for (const hydrator of this.hydrators) {
      try {
        hydrated = await hydrator.hydrate(hydrated, viewer);
      } catch (error) {
        this.logger.warn(
          `Signal hydrator "${hydrator.name}" failed: ${String(error)}`,
        );
      }
    }
    return hydrated;
  }
}
