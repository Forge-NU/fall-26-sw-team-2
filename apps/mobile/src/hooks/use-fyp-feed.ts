import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchFypPage } from '@/api/feed';
import { rememberItineraries } from '@/data/itineraries';
import type { Itinerary } from '@/data/mock';
import { toItinerary } from '@/data/trip-to-itinerary';

const PAGE_SIZE = 10;

export type FypStatus = 'loading' | 'refreshing' | 'loadingMore' | 'idle' | 'error';

export type FypFeed = {
  itineraries: Itinerary[];
  status: FypStatus;
  hasMore: boolean;
  /** Fetches the next page; does nothing while a page is loading or after an error. */
  loadMore: () => void;
  /** Starts over with a new session (pull to refresh). */
  refresh: () => void;
  /** Recovers from an error: reloads the first page, or the page that failed. */
  retry: () => void;
};

/**
 * Pages through GET /api/feed/fyp. The cursor carries a feed session, and the API
 * leaves out whatever that session was already served, so pages never repeat.
 * Starting over (no cursor) begins a new session.
 */
export function useFypFeed(): FypFeed {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [status, setStatus] = useState<FypStatus>('loading');
  const [cursor, setCursor] = useState<string | null>(null);
  // Bumped when a new session starts or the screen unmounts, so a page that
  // arrives late is ignored.
  const session = useRef(0);
  const inFlight = useRef(false);

  // State only changes once the page arrives, so this is safe to start from an effect.
  const load = useCallback((from: string | null) => {
    const thisSession = session.current;
    const stillCurrent = () => thisSession === session.current;
    inFlight.current = true;

    void fetchFypPage(from, PAGE_SIZE)
      .then((page) => {
        if (!stillCurrent()) return;
        const loaded = page.items.map((item) => toItinerary(item));
        rememberItineraries(loaded);
        setItineraries((current) => (from ? appendNew(current, loaded) : loaded));
        setCursor(page.nextCursor);
        setStatus('idle');
      })
      .catch(() => {
        if (stillCurrent()) setStatus('error');
      })
      .finally(() => {
        if (stillCurrent()) inFlight.current = false;
      });
  }, []);

  useEffect(() => {
    load(null);
    return () => {
      session.current += 1;
    };
  }, [load]);

  const startSession = useCallback(
    (nextStatus: 'loading' | 'refreshing') => {
      session.current += 1;
      setCursor(null);
      setStatus(nextStatus);
      load(null);
    },
    [load],
  );

  const loadMore = useCallback(() => {
    if (inFlight.current || status !== 'idle' || !cursor) return;
    setStatus('loadingMore');
    load(cursor);
  }, [cursor, load, status]);

  const refresh = useCallback(() => startSession('refreshing'), [startSession]);

  const retry = useCallback(() => {
    if (cursor && itineraries.length > 0) {
      setStatus('loadingMore');
      load(cursor);
    } else {
      startSession('loading');
    }
  }, [cursor, itineraries.length, load, startSession]);

  return { itineraries, status, hasMore: cursor !== null, loadMore, refresh, retry };
}

function appendNew(current: Itinerary[], loaded: Itinerary[]) {
  const seen = new Set(current.map((itinerary) => itinerary.id));
  return [...current, ...loaded.filter((itinerary) => !seen.has(itinerary.id))];
}
