import type { InfiniteData } from '@tanstack/react-query';
import type { NotificationResponse, PaginatedResponse, TripInviteStatus, UserSummary } from 'shared-types';

export type NotificationPages = InfiniteData<PaginatedResponse<NotificationResponse>>;

/** Past this the badge shows "9+" */
export const BADGE_MAX = 9;

/** The bell's badge: nothing at 0, then the count up to 9, then "9+". */
export function badgeText(count: number | undefined): string | null {
  if (!count || count < 1) return null;
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
}

export function bellLabel(count: number | undefined): string {
  return count && count > 0 ? `Notifications, ${count} unread` : 'Notifications';
}

/** Same rule as UserRow: full name, or the username when there's no name. */
export function displayName(user: UserSummary): string {
  return `${user.firstName} ${user.lastName}`.trim() || (user.username ?? '');
}

/** What an answered invite says in place of Accept and Decline */
export const INVITE_STATE_TEXT: Record<Exclude<TripInviteStatus, 'pending'>, string> = {
  accepted: 'You joined this trip',
  declined: 'You declined',
  cancelled: 'This invite was cancelled',
};

/**
 * Whether the inbox knows how to show this row. Types added later (likes,
 * follows) stay hidden in this version of the app instead of reading wrong.
 */
export function isShownNotification(n: NotificationResponse): boolean {
  if (!n.trip) return false;
  return n.type === 'trip_invite_accepted' || (n.type === 'trip_invite' && n.invite !== null);
}

/** The row's sentence, split so the screen can bold the name and the trip. */
export function notificationParts(n: NotificationResponse): { name: string; verb: string; trip: string } {
  const name = displayName(n.actor);
  const trip = n.trip?.title ?? 'a trip';
  return n.type === 'trip_invite_accepted'
    ? { name, verb: ' joined ', trip }
    : { name, verb: ' invited you to ', trip };
}

/**
 * The trip a tap opens, or null when the row isn't tappable. You can only open
 * a trip you're on: someone joining yours, or an invite you accepted. A pending,
 * declined or cancelled invite's trip may be a draft you can't see.
 */
export function notificationTripId(n: NotificationResponse): string | null {
  if (!n.trip) return null;
  if (n.type === 'trip_invite_accepted') return n.trip.id;
  return n.invite?.status === 'accepted' ? n.trip.id : null;
}

/** Sets one invite's status in every loaded page, for the optimistic Accept / Decline. */
export function setInviteStatus(
  data: NotificationPages | undefined,
  inviteId: string,
  status: TripInviteStatus,
): NotificationPages | undefined {
  if (!data?.pages.some((page) => page.items.some((n) => n.invite?.id === inviteId))) return data;
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.items.some((n) => n.invite?.id === inviteId)
        ? {
            ...page,
            items: page.items.map((n) => (n.invite?.id === inviteId ? { ...n, invite: { ...n.invite, status } } : n)),
          }
        : page,
    ),
  };
}

export function findInviteStatus(data: NotificationPages | undefined, inviteId: string): TripInviteStatus | null {
  for (const page of data?.pages ?? []) {
    const match = page.items.find((n) => n.invite?.id === inviteId);
    if (match?.invite) return match.invite.status;
  }
  return null;
}

/**
 * The toast after a 409, from the invite's status once the list reloads. Still
 * pending means the conflict was something else (like a full trip), so the
 * server's message wins.
 */
export function conflictMessage(status: TripInviteStatus | null, serverMessage: string): string {
  switch (status) {
    case 'accepted':
      return 'You already joined this trip';
    case 'declined':
      return 'You already declined this invite';
    case 'pending':
      return serverMessage;
    default:
      return INVITE_STATE_TEXT.cancelled;
  }
}
