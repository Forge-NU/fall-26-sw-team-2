import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/icon';
import { Radii, Spacing } from '@/constants/theme';

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
          <AppText variant="heading">
            YUJI
          </AppText>
          <AppText variant="caption">GO SOMEWHERE</AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.leaderboard} accessibilityRole="button">
          <Icon name="trophy" size={19} color="coral" />
          <AppText variant="caption">
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
    borderRadius: Radii.medium,
  },
  header: {
    height: 60,
    paddingHorizontal: Spacing.three,
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
