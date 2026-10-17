import { Injectable } from '@nestjs/common';
import { CandidateFilter, FeedCandidate, ViewerContext } from '../feed.types';

@Injectable()
export class ExcludeOwnTripsFilter implements CandidateFilter {
  readonly name = 'exclude-own-trips';

  apply(
    candidates: readonly FeedCandidate[],
    viewer: ViewerContext,
  ): Promise<FeedCandidate[]> {
    return Promise.resolve(
      candidates.filter((candidate) => candidate.authorId !== viewer.viewerId),
    );
  }
}
