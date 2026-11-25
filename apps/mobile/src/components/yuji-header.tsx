import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { AppText } from '@/components/ui/app-text';
import { Spacing } from '@/constants/theme';

// Width ÷ height of the "yuji" wordmark (Figma: Main Design File › Logo v2)
export const WORDMARK_ASPECT_RATIO = 1.218;

// The black "yuji" wordmark; `size` is its height
export function YujiLogo({ size = 26 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/yuji/wordmark.png')}
      style={{ width: size * WORDMARK_ASPECT_RATIO, height: size }}
      contentFit="contain"
      accessibilityLabel="Yuji"
    />
  );
}

export function YujiHeader() {
  return (
    <View style={styles.header}>
      <View>
        <YujiLogo />
        <AppText variant="caption">GO SOMEWHERE</AppText>
      </View>
      <View style={styles.actions}>
        {/* The Leaderboard button goes here once leaderboards exist */}
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Lines the bell up with the gutter instead of the button's padding, like ScreenHeader
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: -Spacing.two,
  },
});
