import { Inject, Injectable } from '@nestjs/common';
import type {
  CandidateScorer,
  FeedCandidate,
  ViewerContext,
} from '../feed.types';
import { FYP_CONFIG, type FypConfig } from '../fyp/fyp.config';
import { applyMultiplier } from './score-utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Demotes older itineraries, but only down to a floor:
//   multiplier = floor + (1 - floor) × 0.5^(age / halfLife)
// X drops posts older than 48 hours instead; itineraries age much more slowly.
@Injectable()
export class RecencyScorer implements CandidateScorer {
  readonly name = 'recency';

  constructor(@Inject(FYP_CONFIG) private readonly config: FypConfig) {}

  score(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    const { halfLifeDays, floor } = this.config.recency;
    const halfLifeMs = halfLifeDays * MS_PER_DAY;
    return Promise.resolve(
      candidates.map((candidate) => {
        const ageMs = Math.max(
          0,
          viewer.now.getTime() - candidate.createdAt.getTime(),
        );
        const multiplier = floor + (1 - floor) * 0.5 ** (ageMs / halfLifeMs);
        return {
          ...candidate,
          score: applyMultiplier(candidate.score, multiplier),
        };
      }),
    );
  }
}
