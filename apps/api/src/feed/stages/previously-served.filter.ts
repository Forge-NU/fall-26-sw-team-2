import { Injectable } from '@nestjs/common';
import type {
  CandidateFilter,
  FeedCandidate,
  ViewerContext,
} from '../feed.types';

// Drops trips served earlier in this feed session, so pages never repeat
// (X: PreviouslyServedPostsFilter).
@Injectable()
export class PreviouslyServedFilter implements CandidateFilter {
  readonly name = 'previously-served';

  apply(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    const served = viewer.servedTripIds;
    return Promise.resolve(
      served
        ? candidates.filter((candidate) => !served.has(candidate.tripId))
        : [...candidates],
    );
  }
}
