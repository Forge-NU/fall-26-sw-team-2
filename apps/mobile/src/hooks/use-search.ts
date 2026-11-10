import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys } from '@/api/query-keys';
import { isSearchable, search, type SearchKind } from '@/api/search';
import { uniqueById } from '@/lib/follow-cache';

const DEBOUNCE_MS = 300;

/** `value`, once it has stopped changing for `ms` */
function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** One result type, a page at a time */
function useSearchType<K extends SearchKind>(type: K, q: string, enabled: boolean, show: boolean) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.search(type, q),
    // React Query aborts the signal when the query changes, so a slow
    // response for an older query is dropped rather than shown.
    queryFn: ({ pageParam, signal }) => search(type, q, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    // A follow can shift the server's pages, so the next page may repeat someone
    items: show ? uniqueById(query.data?.pages.flatMap((page) => page.items) ?? []) : [],
    isFetching: query.isFetching,
    /** The first page failed (a failed "Show more" keeps what's loaded) */
    failed: show && query.isError && !query.isFetchNextPageError,
    hasMore: show && query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refetch: query.refetch,
  };
}

export type SearchSection = ReturnType<typeof useSearchType>;

/**
 * People and places for the Map tab search bar (SRCH-2). Waits for typing to
 * pause, so a quick typist sends one request per pause rather than one per key.
 */
export function useSearch(query: string) {
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);
  const enabled = isSearchable(debounced);
  const show = enabled && isSearchable(trimmed);

  const people = useSearchType('people', debounced, enabled, show);
  const places = useSearchType('places', debounced, enabled, show);

  return {
    people,
    places,
    /** Waiting on the debounce or a request (including a retry) */
    searching: isSearchable(trimmed) && (debounced !== trimmed || people.isFetching || places.isFetching),
    tooShort: !isSearchable(trimmed),
    /** Retries whichever types failed */
    retry: () => {
      if (people.failed) void people.refetch();
      if (places.failed) void places.refetch();
    },
  };
}
