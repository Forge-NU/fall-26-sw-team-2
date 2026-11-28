import { useMemo } from 'react';
import type { FeedItem, FeedType } from 'shared-types';

import { getFeed } from '@/api/feed';
import { queryKeys } from '@/api/query-keys';
import { useInfiniteList } from '@/hooks/use-infinite-list';

/**
 * One feed tab (#27 FEED-2), a page of trip cards at a time. Pull to refresh
 * refetches every loaded page from the top, so a newly published trip shows
 * first and pushes the rest down without repeating any. `enabled: false`
 * skips loading, for a tab that isn't showing.
 */
export function useFeed(type: FeedType, { enabled = true }: { enabled?: boolean } = {}) {
  const list = useInfiniteList<FeedItem>({
    queryKey: queryKeys.feed(type),
    fetchPage: (cursor, signal) => getFeed(type, cursor, signal),
    enabled,
  });

  // The API's keyset pages never overlap, but if one is refetched while the
  // feed changes under it, keep the first copy of a trip rather than show two
  const { data } = list;
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => {
        if (seen.has(item.trip.id)) return false;
        seen.add(item.trip.id);
        return true;
      });
  }, [data]);

  return { ...list, items };
}
