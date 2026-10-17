import { Inject, Injectable } from '@nestjs/common';
import type { CandidateScorer, FeedCandidate } from '../feed.types';
import { FYP_CONFIG, type FypConfig } from '../fyp/fyp.config';
import { applyMultiplier, compareByScore } from './score-utils';

// Demotes repeat trips from the same author (X: author diversity in
// RankingScorer). In score order, an author's nth trip (counting from 0) is
// multiplied by max(floor, decay^n). Run it last so it sees final scores.
@Injectable()
export class AuthorDiversityScorer implements CandidateScorer {
  readonly name = 'author-diversity';

  constructor(@Inject(FYP_CONFIG) private readonly config: FypConfig) {}

  score(candidates: readonly FeedCandidate[]): Promise<FeedCandidate[]> {
    const { decay, floor } = this.config.authorDiversity;
    const order = [...candidates.keys()].sort((a, b) =>
      compareByScore(candidates[a], candidates[b]),
    );
    const seenPerAuthor = new Map<string, number>();
    const result = [...candidates];

    for (const index of order) {
      const candidate = candidates[index];
      const earlier = seenPerAuthor.get(candidate.authorId) ?? 0;
      seenPerAuthor.set(candidate.authorId, earlier + 1);
      result[index] = {
        ...candidate,
        score: applyMultiplier(
          candidate.score,
          Math.max(floor, decay ** earlier),
        ),
      };
    }

    return Promise.resolve(result);
  }
}
