import { Inject, Injectable } from '@nestjs/common';
import type { ViewerContext, ViewerData, ViewerHydrator } from '../feed.types';
import {
  SERVED_HISTORY_STORE,
  type ServedHistoryStore,
} from '../served-history.store';

// Loads what this feed session has already been served (X: ServedHistoryQueryHydrator).
@Injectable()
export class ServedHistoryHydrator implements ViewerHydrator {
  readonly name = 'served-history';

  constructor(
    @Inject(SERVED_HISTORY_STORE) private readonly store: ServedHistoryStore,
  ) {}

  async hydrate(viewer: ViewerContext): Promise<ViewerData> {
    return { servedTripIds: await this.store.get(viewer.sessionId) };
  }
}
