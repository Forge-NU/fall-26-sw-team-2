import { Inject, Injectable } from '@nestjs/common';
import type {
  FeedCandidate,
  FeedSideEffect,
  ViewerContext,
} from '../feed.types';
import {
  SERVED_HISTORY_STORE,
  type ServedHistoryStore,
} from '../served-history.store';

// Records the page just served so the next one can skip it
// (X: UpdateServedHistorySideEffect).
@Injectable()
export class UpdateServedHistorySideEffect implements FeedSideEffect {
  readonly name = 'update-served-history';

  constructor(
    @Inject(SERVED_HISTORY_STORE) private readonly store: ServedHistoryStore,
  ) {}

  run(viewer: ViewerContext, served: readonly FeedCandidate[]): Promise<void> {
    return this.store.add(
      viewer.sessionId,
      served.map((candidate) => candidate.tripId),
    );
  }
}
