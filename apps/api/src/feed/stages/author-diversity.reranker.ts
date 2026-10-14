import { Inject, Injectable } from '@nestjs/common';
import { FeedReranker, ScoredCandidate } from '../feed.types';
import { FOR_YOU_CONFIG, type ForYouConfig } from '../for-you/for-you.config';

// Greedy rerank that keeps one author from filling the screen: at each slot, pick the
// candidate with the best score after a penalty for same-author items among the last
// `authorWindow` picks. Output keeps the original scores. O(n^2) in pool size.
@Injectable()
export class AuthorDiversityReranker implements FeedReranker {
  constructor(@Inject(FOR_YOU_CONFIG) private readonly config: ForYouConfig) {}

  rerank(ranked: readonly ScoredCandidate[]): ScoredCandidate[] {
    const { authorWindow, repeatPenalty } = this.config.diversity;
    const remaining = [...ranked];
    const result: ScoredCandidate[] = [];

    while (remaining.length > 0) {
      const recentAuthors = result
        .slice(-authorWindow)
        .map((item) => item.authorId);
      let bestIndex = 0;
      let bestScore = -Infinity;

      remaining.forEach((candidate, index) => {
        const repeats = recentAuthors.filter(
          (authorId) => authorId === candidate.authorId,
        ).length;
        const adjusted = candidate.score * repeatPenalty ** repeats;
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestIndex = index;
        }
      });

      result.push(...remaining.splice(bestIndex, 1));
    }

    return result;
  }
}
