import { Palette } from './palette';

// NOTIF-2 (#137). There are no DES-1 frames for these yet (#130), so they
// follow the app's existing sizes until the frames land.
export const NotificationTokens = {
  /** The bell's unread badge, including its ring */
  badgeSize: 20,
  badgeRing: 2,
  badgeOffset: 4,
  badgeBackground: Palette.coral,
  /** The dot on rows that were unread when the inbox opened */
  unreadDotSize: 8,
} as const;
