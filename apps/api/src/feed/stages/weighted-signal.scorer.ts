import { Inject, Injectable } from '@nestjs/common';
import { CandidateScorer, FEED_SIGNALS, FeedCandidate } from '../feed.types';
import { FOR_YOU_CONFIG, type ForYouConfig } from '../for-you/for-you.config';

// Weighted sum of signals. Missing signals count as 0; values are clamped to [0, 1]
// so one badly normalized hydrator can't dominate the ranking.
@Injectable()
export class WeightedSignalScorer implements CandidateScorer {
  constructor(@Inject(FOR_YOU_CONFIG) private readonly config: ForYouConfig) {}

  score(candidate: FeedCandidate): number {
    let total = 0;
    for (const signal of FEED_SIGNALS) {
      const value = candidate.signals[signal] ?? 0;
      total += this.config.weights[signal] * Math.min(1, Math.max(0, value));
    }
    return total;
  }
}
