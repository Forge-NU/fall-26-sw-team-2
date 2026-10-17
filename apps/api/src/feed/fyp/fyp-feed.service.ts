import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '../feed-cursor';
import type {
  CandidateFilter,
  CandidateHydrator,
  CandidateScorer,
  CandidateSelector,
  CandidateSource,
  FeedCandidate,
  FeedPage,
  FeedSideEffect,
  ViewerContext,
  ViewerHydrator,
} from '../feed.types';
import {
  FYP_CANDIDATE_HYDRATORS,
  FYP_CONFIG,
  FYP_FILTERS,
  FYP_SCORERS,
  FYP_SELECTOR,
  FYP_SIDE_EFFECTS,
  FYP_SOURCES,
  FYP_VIEWER_HYDRATORS,
  type FypConfig,
} from './fyp.config';

export interface FeedPageRequest {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class FypFeedService {
  private readonly logger = new Logger(FypFeedService.name);

  constructor(
    @Inject(FYP_CONFIG) private readonly config: FypConfig,
    @Inject(FYP_VIEWER_HYDRATORS)
    private readonly viewerHydrators: ViewerHydrator[],
    @Inject(FYP_SOURCES) private readonly sources: CandidateSource[],
    @Inject(FYP_CANDIDATE_HYDRATORS)
    private readonly candidateHydrators: CandidateHydrator[],
    @Inject(FYP_FILTERS) private readonly filters: CandidateFilter[],
    @Inject(FYP_SCORERS) private readonly scorers: CandidateScorer[],
    @Inject(FYP_SELECTOR) private readonly selector: CandidateSelector,
    @Inject(FYP_SIDE_EFFECTS) private readonly sideEffects: FeedSideEffect[],
  ) {}

  // Each page is the best of what this session hasn't been served yet, so pages never
  // repeat even when scores change between requests. No cursor starts a new session.
  async getPage(
    viewer: Pick<ViewerContext, 'viewerId' | 'now'>,
    request: FeedPageRequest = {},
  ): Promise<FeedPage> {
    const size = Math.min(
      Math.max(request.limit ?? this.config.defaultPageSize, 1),
      this.config.maxPageSize,
    );
    const sessionId = request.cursor
      ? decodeCursor(request.cursor)
      : randomUUID();
    const context = await this.hydrateViewer({ ...viewer, sessionId });

    let candidates = await this.retrieve(context);
    for (const hydrator of this.candidateHydrators) {
      candidates = await this.runStage(
        'Candidate hydrator',
        hydrator.name,
        candidates,
        (input) => hydrator.hydrate(input, context),
      );
    }

    // Filters are not caught: if one fails we error rather than show something the
    // viewer shouldn't see.
    for (const filter of this.filters) {
      candidates = await filter.apply(candidates, context);
    }

    for (const scorer of this.scorers) {
      candidates = await this.runStage(
        'Scorer',
        scorer.name,
        candidates,
        (input) => scorer.score(input, context),
      );
    }

    const page = this.selector.select(candidates, context, size);
    await this.runSideEffects(context, page);

    return {
      items: page.map(({ itineraryId, authorId, score, sources }) => ({
        itineraryId,
        authorId,
        score,
        sources,
      })),
      nextCursor:
        candidates.length > page.length ? encodeCursor(sessionId) : null,
    };
  }

  private async hydrateViewer(base: ViewerContext): Promise<ViewerContext> {
    const results = await Promise.allSettled(
      this.viewerHydrators.map((hydrator) => hydrator.hydrate(base)),
    );
    const viewer = { ...base };
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        Object.assign(viewer, result.value);
      } else {
        this.logger.warn(
          `Viewer hydrator "${this.viewerHydrators[index].name}" failed: ${String(result.reason)}`,
        );
      }
    });
    return viewer;
  }

  // A failing source shouldn't empty the feed, so drop it and keep the rest. An
  // itinerary returned by several sources keeps the first source's copy.
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
        } else {
          byId.set(candidate.itineraryId, {
            ...candidate,
            sources: [sourceName],
            predictions: {},
            score: 0,
          });
        }
      }
    });

    return [...byId.values()];
  }

  // Hydrators and scorers fail open: if one throws or returns a different number of
  // candidates, its output is dropped and the pipeline carries on without it.
  private async runStage(
    stage: string,
    name: string,
    candidates: FeedCandidate[],
    run: (input: FeedCandidate[]) => Promise<FeedCandidate[]>,
  ): Promise<FeedCandidate[]> {
    try {
      const output = await run(candidates);
      if (output.length === candidates.length) {
        return output;
      }
      this.logger.warn(
        `${stage} "${name}" returned ${output.length} of ${candidates.length} candidates; skipped`,
      );
    } catch (error) {
      this.logger.warn(`${stage} "${name}" failed: ${String(error)}`);
    }
    return candidates;
  }

  // Awaited so the next page sees this page's served history. Failures are logged,
  // not thrown: the viewer already has their page.
  private async runSideEffects(
    viewer: ViewerContext,
    page: FeedCandidate[],
  ): Promise<void> {
    const results = await Promise.allSettled(
      this.sideEffects.map((sideEffect) => sideEffect.run(viewer, page)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.warn(
          `Side effect "${this.sideEffects[index].name}" failed: ${String(result.reason)}`,
        );
      }
    });
  }
}
