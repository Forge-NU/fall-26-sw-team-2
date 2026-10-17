import { Inject, Injectable } from '@nestjs/common';
import {
  FEED_ACTIONS,
  type CandidateScorer,
  type FeedCandidate,
} from '../feed.types';
import { FYP_CONFIG, type FypConfig } from '../fyp/fyp.config';

// Combines predicted probabilities into one score (X: the value model in RankingScorer):
//   score = Σ weight[action] × P(action)
// Weights multiply predicted probabilities, not raw counts. Rare actions like report
// get large weights so their small probabilities can move the ranking at all.
@Injectable()
export class WeightedActionScorer implements CandidateScorer {
  readonly name = 'weighted-action';

  constructor(@Inject(FYP_CONFIG) private readonly config: FypConfig) {}

  score(candidates: readonly FeedCandidate[]): Promise<FeedCandidate[]> {
    return Promise.resolve(
      candidates.map((candidate) => ({
        ...candidate,
        score: FEED_ACTIONS.reduce(
          (total, action) =>
            total +
            this.config.actionWeights[action] *
              (candidate.predictions[action] ?? 0),
          0,
        ),
      })),
    );
  }
}
