import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Radius, ScreenGutter } from '@/constants/theme';

export function YujiLogo({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/yuji/logo.png')}
      style={[styles.logo, { width: size, height: size }]}
      accessibilityLabel="Yuji"
    />
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
          <Icon name="trophy" size={19} color="coral" />
          <AppText variant="bold" size={11}>
            Leaderboard
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8}>
          <Icon name="bell" size={21} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: Radius.md,
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
