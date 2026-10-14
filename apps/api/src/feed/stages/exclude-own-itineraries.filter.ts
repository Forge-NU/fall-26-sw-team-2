import { Injectable } from '@nestjs/common';
import { CandidateFilter, FeedCandidate, ViewerContext } from '../feed.types';

@Injectable()
export class ExcludeOwnItinerariesFilter implements CandidateFilter {
  readonly name = 'exclude-own-itineraries';

  apply(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    return Promise.resolve(
      candidates.filter((candidate) => candidate.authorId !== viewer.viewerId),
    );
  }
}
