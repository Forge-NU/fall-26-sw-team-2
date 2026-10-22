import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import type { PaginatedResponse } from 'shared-types';

type InfiniteListOptions<T> = {
  queryKey: QueryKey;
  /** Fetches the page after `cursor`, which is null for the first page */
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<PaginatedResponse<T>>;
  enabled?: boolean;
};

/**
 * A cursor-paginated list, for any endpoint that returns `{ items, nextCursor }`.
 * `items` holds every page loaded so far; pass `loadMore` to FlatList's `onEndReached`.
 */
export function useInfiniteList<T>({ queryKey, fetchPage, enabled }: InfiniteListOptions<T>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
  });

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    loadMore: () => {
      // FlatList fires onEndReached repeatedly, and after a failed page it would
      // keep retrying; the screen offers its own retry (fetchNextPage) instead.
      if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) {
        void query.fetchNextPage();
      }
    },
  };
}
