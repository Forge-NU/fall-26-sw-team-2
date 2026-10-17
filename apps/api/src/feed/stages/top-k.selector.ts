import { Inject, Injectable } from '@nestjs/common';
import type {
  CandidateSelector,
  FeedCandidate,
  ViewerContext,
} from '../feed.types';
import { FYP_CONFIG, type FypConfig } from '../fyp/fyp.config';
import { compareByScore } from './score-utils';

// Sorts by score and keeps the top `size` (X: TopKScoreSelector), with one slot held
// for a new author (a simpler take on X's new-author boost): if none of the first
// `position + 1` trips is from an author under `impressionThreshold` impressions,
// the best-scoring one further down moves up into `position`.
@Injectable()
export class TopKSelector implements CandidateSelector {
  constructor(@Inject(FYP_CONFIG) private readonly config: FypConfig) {}

  select(
    candidates: readonly FeedCandidate[],
    _viewer: ViewerContext,
    size: number,
  ): FeedCandidate[] {
    const { impressionThreshold, position } = this.config.newAuthorSlot;
    const slot = Math.min(position, size - 1);
    const isNewAuthor = (candidate: FeedCandidate) =>
      candidate.authorImpressions !== undefined &&
      candidate.authorImpressions < impressionThreshold;

    const sorted = [...candidates].sort(compareByScore);
    if (!sorted.slice(0, slot + 1).some(isNewAuthor)) {
      const index = sorted.findIndex(
        (candidate, i) => i > slot && isNewAuthor(candidate),
      );
      if (index !== -1) {
        sorted.splice(slot, 0, ...sorted.splice(index, 1));
      }
    }

    return sorted.slice(0, size);
  }
}
