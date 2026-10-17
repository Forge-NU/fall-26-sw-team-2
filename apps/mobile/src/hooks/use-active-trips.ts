import { useCallback, useEffect, useState } from 'react';

import { getActiveTrips } from '@/api/trips';
import type { TripResponse } from '@/api/types';
import { isActiveTrip, pickSuggestedTrip } from '@/lib/trips';
import { todayLocalIso } from '@/utils/local-date';

// STAND-IN (fetching only): APP-1 (#30) sets up React Query. Once it lands,
// fetch with a query instead of useEffect; the filtering and suggestion stay.
//
// The user's active trips for the story composer's trip chooser, and the one
// to preselect. Only active trips are returned, so nothing else can be picked.
export function useActiveTrips() {
  const [today] = useState(todayLocalIso);
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getActiveTrips(today)
      .then((response) => {
        if (cancelled) return;
        setTrips(response.items.filter((trip) => isActiveTrip(trip, today)));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today, requestId]);

  const reload = useCallback(() => {
    setLoading(true);
    setRequestId((id) => id + 1);
  }, []);

  // After a quick-create, add the new trip without refetching.
  const addTrip = useCallback(
    (trip: TripResponse) => {
      if (isActiveTrip(trip, today)) setTrips((current) => [trip, ...current]);
    },
    [today],
  );

  return {
    today,
    trips,
    suggestedTrip: pickSuggestedTrip(trips, today),
    loading,
    error,
    reload,
    addTrip,
  };
}
