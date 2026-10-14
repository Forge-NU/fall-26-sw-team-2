import { Inject, Injectable } from '@nestjs/common';
import { FeedCandidate, SignalHydrator, ViewerContext } from '../feed.types';
import { FOR_YOU_CONFIG, type ForYouConfig } from '../for-you/for-you.config';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Exponential decay on itinerary age: 1 when brand new, 0.5 after one half-life.
@Injectable()
export class RecencyHydrator implements SignalHydrator {
  readonly name = 'recency';

  constructor(@Inject(FOR_YOU_CONFIG) private readonly config: ForYouConfig) {}

  hydrate(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    const halfLifeMs = this.config.recencyHalfLifeDays * MS_PER_DAY;
    return Promise.resolve(
      candidates.map((candidate) => {
        const ageMs = Math.max(
          0,
          viewer.now.getTime() - candidate.createdAt.getTime(),
        );
        return {
          ...candidate,
          signals: {
            ...candidate.signals,
            recency: 0.5 ** (ageMs / halfLifeMs),
          },
        };
      }),
    );
  }
}
