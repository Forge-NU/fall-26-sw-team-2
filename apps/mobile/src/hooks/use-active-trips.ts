import { useCallback, useEffect, useState } from 'react';

import { getActiveTrips } from '@/api/trips';
import type { TripResponse } from '@/api/types';
import { isActiveTrip, pickSuggestedTrip } from '@/lib/trips';
import { todayLocalIso } from '@/utils/local-date';

// Active trips for the story composer, and which one to preselect.
// STAND-IN for APP-1 (#30): fetch with React Query once it's set up.
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

  // After a quick-create
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
