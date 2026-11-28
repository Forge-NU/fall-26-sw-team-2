import { Pressable, StyleSheet, View } from 'react-native';
import type { NotificationResponse, TripInviteStatus } from 'shared-types';

import { Icon, type IconName } from '@/components/icon';
import { UserRow } from '@/components/content/user-row';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarTokens } from '@/constants/avatar-tokens';
import { NotificationTokens } from '@/constants/notification-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useAnswerInvite, type InviteAnswer } from '@/hooks/use-notifications';
import { formatTimeAgo } from '@/lib/comment-cache';
import { INVITE_STATE_TEXT, MEMBERS_SEE_DRAFTS, notificationParts, notificationTripId } from '@/lib/notifications';
import { formatDateRange } from '@/utils/local-date';

type NotificationRowProps = {
  notification: NotificationResponse;
  /** Shows a dot: unread when the list loaded, before the inbox marked it read */
  unread: boolean;
  onOpenTrip: (tripId: string) => void;
};

const STATE_ICONS: Record<Exclude<TripInviteStatus, 'pending'>, IconName> = {
  accepted: 'check',
  declined: 'x',
  cancelled: 'circle-minus',
};

/**
 * A trip invite (Accept / Decline while pending, its state after) or someone
 * joining your trip. Rows for a trip you're on open it.
 */
export function NotificationRow({ notification, unread, onOpenTrip }: NotificationRowProps) {
  const answer = useAnswerInvite();
  const { name, verb, trip } = notificationParts(notification);
  // Not until the accept goes through, even though the row already says you joined
  const tripId = answer.isPending ? null : notificationTripId(notification);
  const status = notification.type === 'trip_invite' ? (notification.invite?.status ?? null) : null;
  const details = [
    notification.trip ? formatDateRange(notification.trip.startDate, notification.trip.endDate) : null,
    formatTimeAgo(notification.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  const respond = (inviteAnswer: InviteAnswer) => {
    const invite = notification.invite;
    if (!invite) return;
    answer.mutate(
      { inviteId: invite.id, answer: inviteAnswer },
      {
        onSuccess: () => {
          if (inviteAnswer === 'accepted' && MEMBERS_SEE_DRAFTS && notification.trip) onOpenTrip(notification.trip.id);
        },
      },
    );
  };

  const content = (
    <View style={styles.row}>
      <View style={styles.main}>
        <UserRow user={notification.actor} subtitle={`${verb.trim()} ${trip}`} />
        <View style={styles.indented}>
          <AppText variant="caption" color="placeholderGray">
            {details}
          </AppText>
          {status === 'pending' ? (
            <View style={styles.buttons}>
              <Button title="Accept" size="compact" filled onPress={() => respond('accepted')} />
              <Button title="Decline" size="compact" variant="secondary" onPress={() => respond('declined')} />
            </View>
          ) : status ? (
            <View style={styles.state}>
              <Icon name={STATE_ICONS[status]} size={Spacing.three} color="placeholderGray" />
              <AppText variant="label" color="placeholderGray">
                {INVITE_STATE_TEXT[status]}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      {unread ? <View accessibilityLabel="Unread" style={styles.dot} /> : null}
    </View>
  );

  if (!tripId) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}${verb}${trip}. Open the trip`}
      onPress={() => onOpenTrip(tripId)}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

/** Loading rows for the inbox: avatar, a line and the buttons' height */
export function NotificationSkeletons() {
  return (
    <View style={styles.skeletons}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton circle width={avatarSize} height={avatarSize} />
          <View style={styles.main}>
            <Skeleton width="70%" />
            <Skeleton width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const avatarSize = AvatarTokens.sizes.small.diameter;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  main: { flex: 1, minWidth: 0, gap: Spacing.one },
  // Lines up with the name, past UserRow's avatar
  indented: { marginLeft: avatarSize + Spacing.two, gap: Spacing.two },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  state: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: {
    width: NotificationTokens.unreadDotSize,
    height: NotificationTokens.unreadDotSize,
    marginTop: Spacing.three,
    borderRadius: Radii.circle,
    backgroundColor: Palette.coral,
  },
  // Same as CardLink
  pressed: { backgroundColor: Palette.peach, borderRadius: Radii.medium },
  skeletons: { gap: Spacing.four, paddingTop: Spacing.two },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
