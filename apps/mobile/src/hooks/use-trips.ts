// STAND-IN for APP-1 (#30): uses React Query directly until its data layer lands.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getTripPosts } from '@/api/posts';
import { queryKeys } from '@/api/query-keys';
import { createTrip, deleteTrip, getTrip, getUserTrips, publishTrip, updateTrip } from '@/api/trips';
import type { CreateTripRequest, PostResponse, TripResponse, UpdateTripRequest } from '@/api/types';
import { useCurrentUser } from '@/lib/current-user';

export function useTrip(id: string) {
  return useQuery({ queryKey: queryKeys.trip(id), queryFn: () => getTrip(id) });
}

// The trip page groups posts by day, so it loads every page up front
export function useTripPosts(tripId: string) {
  return useQuery({
    queryKey: queryKeys.tripPosts(tripId),
    queryFn: async () => {
      const items: PostResponse[] = [];
      let cursor: string | null = null;
      do {
        const page = await getTripPosts(tripId, cursor);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
  });
}

// STAND-IN for PROF-1 (#31): only loads the first page until the profile grid lands
export function useMyTrips() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.userTrips(user.id),
    queryFn: async () => (await getUserTrips(user.id)).items,
  });
}

// Puts the fresh trip in the cache and refreshes every list that shows it
function useStoreTrip() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  return (trip: TripResponse) => {
    queryClient.setQueryData(queryKeys.trip(trip.id), trip);
    void queryClient.invalidateQueries({ queryKey: queryKeys.userTrips(user.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
  };
}

export function useCreateTrip() {
  const storeTrip = useStoreTrip();
  return useMutation({
    // The screen shows the error itself, so skip the global toast
    meta: { toast: false },
    mutationFn: (body: CreateTripRequest) => createTrip(body),
    onSuccess: storeTrip,
  });
}

export function useUpdateTrip(id: string) {
  const storeTrip = useStoreTrip();
  return useMutation({
    meta: { toast: false },
    mutationFn: (body: UpdateTripRequest) => updateTrip(id, body),
    onSuccess: storeTrip,
  });
}

export function usePublishTrip(id: string) {
  const storeTrip = useStoreTrip();
  return useMutation({
    meta: { toast: false },
    mutationFn: () => publishTrip(id),
    onSuccess: storeTrip,
  });
}

// Drops the trip from cached lists right away, so the profile grid updates
// without a manual refresh. The trip's own query is left to garbage-collect,
// since removing it while the trip page is still mounted would refetch a 404.
export function useDeleteTrip(id: string) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  return useMutation({
    meta: { toast: false },
    mutationFn: () => deleteTrip(id),
    onSuccess: () => {
      queryClient.setQueryData<TripResponse[]>(queryKeys.userTrips(user.id), (trips) =>
        trips?.filter((trip) => trip.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.userTrips(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
    },
  });
}
