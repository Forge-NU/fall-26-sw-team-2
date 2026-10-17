import { Inject, Injectable } from '@nestjs/common';
import {
  FEED_ACTIONS,
  type ActionProbabilities,
  type CandidateScorer,
  type FeedCandidate,
} from '../feed.types';
import { FYP_CONFIG, type FypConfig } from '../fyp/fyp.config';

// Stand-in for a trained model (X: PhoenixScorer). Estimates P(action) from the
// itinerary's own engagement rate, smoothed toward a baseline prior so an itinerary
// with a handful of impressions isn't judged on them alone:
//   P(action) = (count + prior × strength) / (impressions + strength)
// Not personalized yet: every viewer gets the same estimate.
@Injectable()
export class EngagementRateScorer implements CandidateScorer {
  readonly name = 'engagement-rate';

  constructor(@Inject(FYP_CONFIG) private readonly config: FypConfig) {}

  score(candidates: readonly FeedCandidate[]): Promise<FeedCandidate[]> {
    const { actionPriors, priorStrength } = this.config;
    return Promise.resolve(
      candidates.map((candidate) => {
        const impressions = candidate.stats?.impressions ?? 0;
        const predictions: ActionProbabilities = {};
        for (const action of FEED_ACTIONS) {
          const count = candidate.stats?.actions[action] ?? 0;
          const estimate =
            (count + actionPriors[action] * priorStrength) /
            (impressions + priorStrength);
          predictions[action] = Math.min(1, estimate);
        }
        return { ...candidate, predictions };
      }),
    );
  }
}
