import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { SearchItems, SearchPage, SearchPreview, SearchType } from 'shared-types';

import { queryKeys } from '@/api/query-keys';
import { search } from '@/api/search';
import { uniqueById } from '@/lib/follow-cache';
import {
  activeFilterCount,
  buildSearchRequest,
  defaultSearchFilters,
  filterError,
  hasSearchWords,
  type SearchCenters,
  type SearchFilters,
  type SearchTab,
} from '@/lib/search/filters';
import { isRefinement } from '@/utils/search-text';

const DEBOUNCE_MS = 300;
// The pages query when the "All" tab is showing: never fetched, and a different
// key from the preview so the two cache shapes never share an entry.
const NO_PAGES = ['search', 'none'] as const;

/** `value`, once it has stopped changing for `ms` */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Map tab search (SRCH-2, SRCH-4): the "All" preview or one type a page at a
 * time, for `query` with the tab and filters kept here.
 *
 * `active` is whether search is open. Closing it (clearing the text, or
 * leaving the Map tab) resets the tab and filters; opening a result and coming
 * back doesn't. Requests wait for typing to pause, and React Query drops the
 * response to a query that has since changed.
 */
export function useSearch({ query, active, centers }: { query: string; active: boolean; centers: SearchCenters }) {
  const [tab, setTab] = useState<SearchTab>('all');
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setTab('all');
      setFilters(defaultSearchFilters());
    }
  }

  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);
  const validationError = filterError(filters, tab, centers);
  const request =
    active && !validationError && hasSearchWords(debounced)
      ? buildSearchRequest(debounced, tab, filters, centers)
      : null;
  const q = request?.q ?? '';
  // Everything about the request except its text
  const filtersKey = request ? JSON.stringify({ ...request, q: undefined }) : '';
  // While the next results load, keep showing the last ones only if this is the
  // same search (tab and filters) being refined, never an unrelated earlier one.
  const sameSearch = (key: readonly unknown[] | undefined) =>
    key?.[3] === filtersKey && isRefinement(key[2] as string, q);

  const preview = useQuery({
    queryKey: queryKeys.search('all', q, filtersKey),
    queryFn: ({ signal }) => search(request!, signal) as Promise<SearchPreview>,
    enabled: request !== null && tab === 'all',
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) => (sameSearch(previousQuery?.queryKey) ? previous : undefined),
  });

  const pages = useInfiniteQuery({
    queryKey: tab === 'all' ? NO_PAGES : queryKeys.search(tab, q, filtersKey),
    queryFn: ({ pageParam, signal }) =>
      search({ ...request!, cursor: pageParam ?? undefined }, signal) as Promise<SearchPage>,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: request !== null && tab !== 'all',
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) => (sameSearch(previousQuery?.queryKey) ? previous : undefined),
  });

  const current = tab === 'all' ? preview : pages;
  const typing = active && !validationError && hasSearchWords(trimmed) && debounced !== trimmed;
  // Results on screen stay only while they're for this search; while typing
  // something new they'd be for the old text.
  const showData = Boolean(current.data) && (!typing || isRefinement(debounced, trimmed));
  const pageError = tab !== 'all' && pages.isFetchNextPageError ? pages.error : null;

  let status: SearchStatus;
  if (!request && !typing) status = 'idle';
  else if (showData) status = 'ready';
  else if (current.isError && !typing) status = 'error';
  else status = 'loading';

  const items: SearchItems[SearchType][] = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const lastPage = pages.data?.pages.at(-1);

  return {
    tab,
    setTab,
    filters,
    /** Takes a value or an updater, like useState's setter */
    setFilters,
    resetFilters: () => setFilters(defaultSearchFilters()),
    validationError,
    activeFilterCount: activeFilterCount(filters, tab),
    status,
    /** A request is waiting on the debounce or the network */
    searching: typing || current.isFetching,
    error: status === 'error' ? current.error : null,
    preview: tab === 'all' && showData ? (preview.data ?? null) : null,
    page:
      tab !== 'all' && showData ? { items: uniqueById(items), nextCursor: lastPage?.nextCursor ?? null } : null,
    loadingMore: pages.isFetchingNextPage,
    pageError,
    loadMore: () => {
      if (tab !== 'all' && pages.hasNextPage && !pages.isFetchingNextPage && !pages.isFetchNextPageError) {
        void pages.fetchNextPage();
      }
    },
    retry: () => {
      if (pageError) void pages.fetchNextPage();
      else void current.refetch();
    },
  };
}
