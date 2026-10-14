import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Radius, ScreenGutter } from '@/constants/theme';

/**
 * The Figma logo is a crop of a larger brand sheet, so the image is scaled up
 * and offset inside a clipped square (same percentages as the design).
 */
export function YujiLogo({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.logo, { width: size, height: size }]}>
      <Image
        source={require('@/assets/images/yuji/logo-sprite.png')}
        style={{
          position: 'absolute',
          width: size * 9.5111,
          height: size * 9.1667,
          left: -size * 7.2222,
          top: -size * 0.6,
        }}
      />
    </View>
  );
}

export function YujiHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <YujiLogo />
        <View style={styles.wordmark}>
          <AppText variant="display" size={22}>
            YUJI
          </AppText>
          <AppText size={7}>GO SOMEWHERE</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.leaderboard} accessibilityRole="button">
          <Icon name="trophy" />
          <AppText variant="bold" size={11}>
            Leaderboard
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
          <Icon name="bell" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  header: {
    height: 60,
    paddingHorizontal: ScreenGutter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    gap: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leaderboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
