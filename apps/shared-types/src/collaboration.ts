import type { UserSummary } from './index.js';

// STAND-IN until #131 COLLAB-1: only the notification types the inbox UI
// (#137 NOTIF-2) needs, shaped from COLLAB-1 and NOTIF-1 (#132). COLLAB-1's
// version of this file replaces it, with the member, invite, bucket and saved
// place types alongside.

/** STAND-IN: `trip_invite_status` in COLLAB-1's schema */
export type TripInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** STAND-IN: `notification_type` in COLLAB-1's schema. More types (likes, follows) come later. */
export type NotificationType = 'trip_invite' | 'trip_invite_accepted';

/** STAND-IN: the trip a notification is about */
export interface NotificationTrip {
  id: string;
  title: string;
  /** YYYY-MM-DD, like TripResponse */
  startDate: string;
  endDate: string;
}

/** STAND-IN: an invite's current state, so one answered or cancelled elsewhere never offers Accept again */
export interface NotificationInvite {
  id: string;
  status: TripInviteStatus;
}

/**
 * STAND-IN: one row of GET /api/me/notifications (#132 NOTIF-1), newest first
 */
export interface NotificationResponse {
  id: string;
  type: NotificationType;
  /** Who did it: the inviter for trip_invite, the person who joined for trip_invite_accepted */
  actor: UserSummary;
  /** Null only for later types that aren't about a trip */
  trip: NotificationTrip | null;
  /** Set for trip_invite, null otherwise */
  invite: NotificationInvite | null;
  readAt: string | null;
  createdAt: string;
}

/** STAND-IN: GET /api/me/notifications/unread-count */
export interface UnreadCountResponse {
  count: number;
}
