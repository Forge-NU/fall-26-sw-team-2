import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { geocodePlace } from '@/api/locations';
import { queryKeys } from '@/api/query-keys';
import { fetchAllTripPosts } from '@/hooks/use-trips';
import { choosePinStart, type LatLng, type PinStart, type PinStartTrip } from '@/lib/pin-start';

// expo-location has no timeout option, and a cold GPS fix can take a while
const POSITION_TIMEOUT_MS = 8000;
// A fix from the last few minutes is close enough to start the map at
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

async function devicePosition(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) return null;

  const recent = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  if (recent) return recent.coords;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
  });
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    return position?.coords ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// Where the drop-a-pin map opens (lib/pin-start.ts has the order). null while
// it's being worked out. Asks for location permission the first time.
export function usePinStart(trip: PinStartTrip | null): PinStart | null {
  const queryClient = useQueryClient();
  const [start, setStart] = useState<PinStart | null>(null);
  const tripId = trip?.id ?? null;
  const destination = trip?.destination ?? null;

  useEffect(() => {
    let cancelled = false;
    void choosePinStart(tripId && destination !== null ? { id: tripId, destination } : null, {
      devicePosition,
      geocode: geocodePlace,
      // Same cache entry as the trip page, so it's often already loaded
      tripPosts: (id) =>
        queryClient.fetchQuery({ queryKey: queryKeys.tripPosts(id), queryFn: () => fetchAllTripPosts(id) }),
    }).then((next) => {
      if (!cancelled) setStart(next);
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient, tripId, destination]);

  return start;
}
