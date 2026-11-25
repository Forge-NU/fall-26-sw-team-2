import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { IconButton } from '@/components/ui/icon-button';
import { NotificationTokens } from '@/constants/notification-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useUnreadCount } from '@/hooks/use-notifications';
import { badgeText, bellLabel } from '@/lib/notifications';

/** The header's bell, with the unread count on a badge. Opens the inbox. */
export function NotificationBell() {
  const count = useUnreadCount().data?.count;
  const badge = badgeText(count);
  return (
    <View>
      <IconButton icon="bell" accessibilityLabel={bellLabel(count)} onPress={() => router.push('/notifications')} />
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color="white">
            {badge}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: NotificationTokens.badgeOffset,
    right: NotificationTokens.badgeOffset,
    minWidth: NotificationTokens.badgeSize,
    height: NotificationTokens.badgeSize,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.circle,
    borderWidth: NotificationTokens.badgeRing,
    borderColor: Palette.warmWhite,
    backgroundColor: NotificationTokens.badgeBackground,
    alignItems: 'center',
    justifyContent: 'center',
    // Taps go to the bell underneath
    pointerEvents: 'none',
  },
});
