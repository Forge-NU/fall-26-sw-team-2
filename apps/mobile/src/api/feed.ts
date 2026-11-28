import type { FeedResponse, FeedType } from 'shared-types';

import { apiGet } from '@/api/client';
import { withMock } from '@/api/mock';
import { mockGetFeed } from '@/api/mock-backend';

// Cards per page. Each card is a trip with its day previews, so pages stay small.
export const FEED_PAGE_SIZE = 10;

// The home feed (#26 FEED-1). `friends` is published trips from people you
// follow, newest publish first. `local` is post-MVP and always an empty page
// for now. FYP has its own endpoint (#118), so it isn't a type here.
export const getFeed = withMock({
  live: true,
  real: (type: FeedType, cursor: string | null, signal?: AbortSignal) =>
    apiGet<FeedResponse>('/api/feed', { type, cursor, limit: FEED_PAGE_SIZE }, { signal }),
  mock: (type: FeedType, cursor: string | null, _signal?: AbortSignal) =>
    mockGetFeed(type, cursor, FEED_PAGE_SIZE),
});
