import type { SearchRequest } from 'shared-types';

import {
  buildSearchRequest,
  filterError,
  hasSearchWords,
  type SearchCenters,
  type SearchFilters,
  type SearchTab,
} from '@/lib/search/filters';
import { isRefinement } from '@/utils/search-text';

// The decisions behind useSearch, kept out of React so they can be tested.

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Search is open while the bar has been focused or still has text. */
export const isSearchOpen = (focused: boolean, query: string) => focused || query.trim() !== '';

/** Closing search resets its tab and filters; nothing else does. */
export const resetsSearch = (wasActive: boolean, active: boolean) => wasActive && !active;

/**
 * The request for the debounced text, or null when search is closed, the text
 * is under 2 characters, or a filter is invalid. `filtersKey` is everything
 * about the request except its text, so the same search refined keeps it.
 */
export function searchRequest({
  active,
  debounced,
  tab,
  filters,
  centers,
}: {
  active: boolean;
  debounced: string;
  tab: SearchTab;
  filters: SearchFilters;
  centers: SearchCenters;
}): { request: SearchRequest | null; q: string; filtersKey: string; validationError: string | null } {
  const validationError = filterError(filters, tab, centers);
  const request =
    active && !validationError && hasSearchWords(debounced)
      ? buildSearchRequest(debounced, tab, filters, centers)
      : null;
  return {
    request,
    q: request?.q ?? '',
    filtersKey: request ? JSON.stringify({ ...request, q: undefined }) : '',
    validationError,
  };
}

/**
 * Whether results for `previousKey` (a search query key: ['search', tab, q,
 * filtersKey]) may stay on screen while `q` loads: only when it's the same
 * search (tab and filters) being refined, never an unrelated earlier one.
 */
export function keepPreviousResults(previousKey: readonly unknown[] | undefined, q: string, filtersKey: string) {
  return previousKey?.[3] === filtersKey && isRefinement(previousKey[2] as string | undefined, q);
}

/**
 * What the screen shows. While a new query waits on the debounce, results on
 * screen stay only if the new text refines the old; otherwise they'd sit under
 * text they don't match. An error shows only when nothing is loaded and
 * nothing newer is pending.
 */
export function searchView({
  active,
  trimmed,
  debounced,
  validationError,
  hasRequest,
  hasData,
  isError,
}: {
  active: boolean;
  trimmed: string;
  debounced: string;
  validationError: string | null;
  hasRequest: boolean;
  hasData: boolean;
  isError: boolean;
}): { typing: boolean; showData: boolean; status: SearchStatus } {
  const typing = active && !validationError && hasSearchWords(trimmed) && debounced !== trimmed;
  const showData = hasData && (!typing || isRefinement(debounced, trimmed));
  let status: SearchStatus;
  if (!hasRequest && !typing) status = 'idle';
  else if (showData) status = 'ready';
  else if (isError && !typing) status = 'error';
  else status = 'loading';
  return { typing, showData, status };
}
