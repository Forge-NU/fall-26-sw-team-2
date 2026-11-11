import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { SearchRequest } from 'shared-types';

import { search } from '@/api/search';
import {
  activeFilterCount, buildSearchRequest, defaultSearchFilters, filterError, hasSearchWords,
  type SearchCenters, type SearchFilters, type SearchTab,
} from '@/lib/search/filters';
import { createSearchSession } from '@/lib/search/session';

/** Pass the route's focus state as active. Leaving search clears filters and
 * results; switching type tabs keeps filter selections, including hidden ones. */
export function useSearch({ active, centers }: { active: boolean; centers: SearchCenters }) {
  const [model, setModel] = useState(() => ({ active, query: '', tab: 'all' as SearchTab, filters: defaultSearchFilters() }));
  if (model.active !== active) {
    setModel({ active, query: '', tab: 'all', filters: defaultSearchFilters() });
  }
  const { query, tab, filters } = model;
  const [session] = useState(() => createSearchSession(search));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const validationError = filterError(filters, tab, centers);
  // Primitive request identity prevents unrelated parent renders from restarting
  // requests, while coordinates changing still invalidate a distance search.
  const requestKey = JSON.stringify(active && !validationError ? buildSearchRequest(query, tab, filters, centers) : null);
  const request = useMemo(() => JSON.parse(requestKey) as SearchRequest | null, [requestKey]);
  useEffect(() => {
    session.setRequest(request);
    return () => session.reset();
  }, [request, session]);
  const setQuery = useCallback((query: string) => {
    setModel(model => ({ ...model, query }));
  }, []);
  const setTab = useCallback((tab: SearchTab) => {
    setModel(model => ({ ...model, tab }));
  }, []);
  const setFilters = useCallback((filters: SearchFilters) => {
    setModel(model => ({ ...model, filters }));
  }, []);
  const resetFilters = useCallback(() => setFilters(defaultSearchFilters()), [setFilters]);
  // Don't expose the previous query's results during the render before effect
  // cleanup; this also prevents a stale error or cursor flashing on tab changes.
  const current = state.requestKey === requestKey;
  return {
    ...state, preview: current ? state.preview : null, page: current ? state.page : null,
    loadingMore: current && state.loadingMore,
    status: current ? state.status : request && hasSearchWords(request.q) ? 'loading' as const : 'idle' as const,
    error: current ? state.error : null, pageError: current ? state.pageError : null,
    query, setQuery, tab, setTab, filters, setFilters, resetFilters, validationError,
    activeFilterCount: activeFilterCount(filters, tab),
    loadMore: () => { if (current && active) return session.loadMore(); },
    retry: () => { if (current && active) session.retry(); },
  };
}
