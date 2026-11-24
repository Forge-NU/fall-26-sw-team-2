import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchPage, TripInvitesResponse } from 'shared-types';

import { cancelTripInvite, listTripInvites, sendTripInvite } from '@/api/collaboration';
import { queryKeys } from '@/api/query-keys';
import { isSearchable, search } from '@/api/search';
import { useDebounced } from '@/hooks/use-search';
import { withInvite, withoutInvite } from '@/lib/invites';

const DEBOUNCE_MS = 300;

/** The trip's pending invites, newest first. Owner only (403 for anyone else). */
export function useTripInvites(tripId: string) {
  return useQuery({
    queryKey: queryKeys.tripInvites(tripId),
    queryFn: ({ signal }) => listTripInvites(tripId, signal),
  });
}

/**
 * People search for the invite screen: the first page of GET /api/search
 * ?type=people, once typing pauses. Kept apart from the Map tab's search
 * cache, which has a different shape.
 */
export function useInviteSearch(tripId: string, query: string) {
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);
  const enabled = isSearchable(debounced);
  const result = useQuery({
    queryKey: queryKeys.inviteSearch(tripId, debounced),
    queryFn: ({ signal }) =>
      search({ q: debounced, type: 'people' }, signal) as Promise<SearchPage<'people'>>,
    enabled,
    staleTime: 60_000,
    // Keep the last results on screen while the next search loads
    placeholderData: (previous) => previous,
  });
  return {
    ...result,
    /** The query is long enough to search */
    active: isSearchable(trimmed),
    /** Waiting for typing to pause, or for the request */
    searching: trimmed !== debounced || result.isFetching,
  };
}

/**
 * Invites someone by username. The new invite goes straight into the pending
 * list. A failure (already on the trip, the trip is full) shows the API's
 * message in the default mutation toast.
 */
export function useSendInvite(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => sendTripInvite(tripId, { username }),
    onSuccess: (invite) => {
      queryClient.setQueryData<TripInvitesResponse>(queryKeys.tripInvites(tripId), (data) => ({
        items: withInvite(data?.items, invite),
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tripInvites(tripId), exact: true }),
  });
}

/**
 * Cancels a pending invite. It leaves the list at once and comes back, with
 * the error toast, if the request fails.
 */
export function useCancelInvite(tripId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.tripInvites(tripId);
  return useMutation({
    mutationFn: (inviteId: string) => cancelTripInvite(inviteId),
    onMutate: async (inviteId) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<TripInvitesResponse>(key);
      queryClient.setQueryData<TripInvitesResponse>(key, (data) => ({ items: withoutInvite(data?.items, inviteId) }));
      return { previous };
    },
    onError: (_error, _inviteId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key, exact: true }),
  });
}
