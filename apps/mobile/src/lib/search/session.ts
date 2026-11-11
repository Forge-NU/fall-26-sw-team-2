import type { SearchItems, SearchPage, SearchPreview, SearchRequest, SearchResponse, SearchType } from 'shared-types';

import { hasSearchWords } from '@/lib/search/filters';

export type SearchFetcher = (request: SearchRequest, signal: AbortSignal) => Promise<SearchResponse>;
export type SearchState = {
  requestKey: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  preview: SearchPreview | null;
  page: SearchPage | null;
  error: unknown;
  loadingMore: boolean;
  pageError: unknown;
};
const emptyState = (): SearchState => ({ requestKey: 'null', status: 'idle', preview: null, page: null, error: null, loadingMore: false, pageError: null });

export function uniqueSearchItems(items: SearchItems[SearchType][]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Owns one search screen's lifetime. It aborts immediately on input changes,
 * including during debounce, and checks generation even if a transport ignores abort. */
export function createSearchSession(fetcher: SearchFetcher, debounceMs = 250) {
  let state = emptyState();
  let request: SearchRequest | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SearchState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    generation++;
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
  };
  async function firstPage(token: number) {
    if (!request || token !== generation) return;
    const current = request;
    controller = new AbortController();
    try {
      const response = await fetcher(current, controller.signal);
      if (token !== generation) return;
      if (current.type) {
        if (!('items' in response)) throw new Error('Unexpected search result type');
        publish({ status: 'ready', page: { ...response, items: uniqueSearchItems(response.items) } });
      } else {
        if ('items' in response) throw new Error('Expected search preview');
        publish({ status: 'ready', preview: response });
      }
    } catch (error) {
      if (token === generation) publish({ status: 'error', error });
    }
  }
  function setRequest(next: SearchRequest | null) {
    cancel();
    request = next ? { ...next, cursor: undefined } : null;
    state = emptyState();
    if (!request || !hasSearchWords(request.q)) {
      publish({ requestKey: JSON.stringify(request) });
      return;
    }
    publish({ status: 'loading', requestKey: JSON.stringify(request) });
    const token = generation;
    timer = setTimeout(() => { void firstPage(token); }, debounceMs);
  }
  async function loadMore() {
    if (!request?.type || state.status !== 'ready' || state.loadingMore || state.pageError || !state.page?.nextCursor) return;
    const token = generation;
    const previous = state.page;
    const cursor = previous.nextCursor!;
    publish({ loadingMore: true, pageError: null });
    controller = new AbortController();
    try {
      const response = await fetcher({ ...request, cursor }, controller.signal);
      if (token !== generation) return;
      if (!('items' in response)) throw new Error('Unexpected search result type');
      if (response.nextCursor === cursor) throw new Error('Search pagination did not advance');
      publish({ loadingMore: false, page: { ...response, items: uniqueSearchItems([...previous.items, ...response.items]) } });
    } catch (error) {
      if (token === generation) publish({ loadingMore: false, pageError: error });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setRequest,
    loadMore,
    retry() {
      if (state.pageError) { publish({ pageError: null }); void loadMore(); }
      else if (state.status === 'error') setRequest(request);
    },
    reset() { setRequest(null); },
  };
}
