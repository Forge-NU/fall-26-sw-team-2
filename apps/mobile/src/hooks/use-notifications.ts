import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
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
import {
  conflictMessage,
  findInviteStatus,
  setInviteStatus,
  type NotificationPages,
} from '@/lib/notifications';
import { showToast } from '@/lib/toast';

/**
 * The bell's count. Refetches whenever the app comes back to the foreground
 * (focusManager is wired to AppState in the root layout), even if it's fresh.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadNotifications,
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchOnWindowFocus: 'always',
    // A badge that didn't refresh isn't worth a toast
    meta: { toast: false },
  });
}

export function useNotifications() {
  return useInfiniteList<NotificationResponse>({
    queryKey: queryKeys.notifications,
    fetchPage: (cursor, signal) => listNotifications(cursor, signal),
  });
}

/**
 * Marks everything as read once the inbox's list has loaded, and clears the
 * badge right away. Waiting for the list means its rows still come back
 * unread, so they show their dots. Leaving the inbox refetches the count, and
 * marks the list stale so the next open loads it again before marking.
 */
export function useMarkAllReadOnOpen(listLoaded: boolean) {
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

  const marked = useRef(false);
  useEffect(() => {
    if (!listLoaded || marked.current) return;
    marked.current = true;
    mutate();
  }, [listLoaded, mutate]);

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
      // You're on a new trip, so its page and your trip lists change
      if (answer === 'accepted') void queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
