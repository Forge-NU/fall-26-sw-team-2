import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { NotificationResponse, UnreadCountResponse } from 'shared-types';

import { ApiError, getErrorMessage } from '@/api/client';
import {
  acceptInvite,
  declineInvite,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
} from '@/api/notifications';
import { queryKeys } from '@/api/query-keys';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useCurrentUser } from '@/lib/current-user';
import {
  conflictMessage,
  findInviteStatus,
  loadedSinceOpen,
  setInviteStatus,
  type NotificationPages,
} from '@/lib/notifications';
import { showToast } from '@/lib/toast';

/** The bell's count. Refetches when the app comes back to the foreground. */
export function useUnreadCount() {
  const query = useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: ({ signal }) => getUnreadCount(signal),
    // A badge that didn't refresh isn't worth a toast
    meta: { toast: false },
  });
  const { refetch } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      // Every tab's header has a bell, so join a fetch that's already running
      if (state === 'active') void refetch({ cancelRefetch: false });
    });
    return () => subscription.remove();
  }, [refetch]);
  return query;
}

export function useNotifications() {
  return useInfiniteList<NotificationResponse>({
    queryKey: queryKeys.notifications,
    fetchPage: (cursor, signal) => listNotifications(cursor, signal),
  });
}

/**
 * Marks everything as read once the inbox has loaded, and clears the badge
 * then. Waiting for the list keeps rows that were unread showing as unread on
 * this visit; marking at the same time as the fetch could return them already
 * read. Leaving the inbox refetches the count, and the list on the next open.
 */
export function useMarkAllReadOnOpen(list: { dataUpdatedAt: number; isFetching: boolean }) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    meta: { toast: false },
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.unreadNotifications, exact: true });
      queryClient.setQueryData<UnreadCountResponse>(queryKeys.unreadNotifications, { count: 0 });
    },
    // Put the real count back on the badge
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications, exact: true }),
  });

  const [openedAt] = useState(Date.now);
  const marked = useRef(false);
  const loaded = loadedSinceOpen(openedAt, list);
  useEffect(() => {
    if (!loaded || marked.current) return;
    marked.current = true;
    mutate();
  }, [loaded, mutate]);

  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadNotifications, exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications, exact: true });
    },
    [queryClient],
  );

  /** Marks rows that arrived since the inbox opened, e.g. after a pull to refresh */
  return () => mutate();
}

export type InviteAnswer = 'accepted' | 'declined';

/**
 * Accept or Decline on one invite row. The row shows the answer straight away
 * and goes back to pending if the request fails. A 409 or 404 means the invite
 * was cancelled or answered somewhere else, so the list reloads to show its
 * real state.
 */
export function useAnswerInvite() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const key = queryKeys.notifications;
  return useMutation({
    meta: { toast: false },
    mutationFn: ({ inviteId, answer }: { inviteId: string; answer: InviteAnswer }) =>
      answer === 'accepted' ? acceptInvite(inviteId) : declineInvite(inviteId),
    onMutate: async ({ inviteId, answer }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const snapshot = queryClient.getQueryData<NotificationPages>(key);
      queryClient.setQueryData<NotificationPages>(key, (data) => setInviteStatus(data, inviteId, answer));
      return { snapshot };
    },
    onError: async (error, { inviteId }, context) => {
      if (context) queryClient.setQueryData(key, context.snapshot);
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        await queryClient.refetchQueries({ queryKey: key, exact: true });
        const status = findInviteStatus(queryClient.getQueryData<NotificationPages>(key), inviteId);
        showToast({ message: conflictMessage(status, getErrorMessage(error)), variant: 'info' });
        return;
      }
      showToast({ message: getErrorMessage(error), variant: 'error' });
    },
    onSuccess: (_invite, { answer }) => {
      if (answer !== 'accepted') return;
      // You're on a new trip, so its page changes (['trips'] covers every trip
      // and its posts), and it joins your trip lists: the profile grid and the
      // post composer's picker (userTrips covers both), and the story
      // composer's active trips. Same lists as creating a trip (use-trips.ts).
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userTrips(user.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
    },
  });
}
