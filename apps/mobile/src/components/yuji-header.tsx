import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
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
        <View>
          <AppText variant="heading">
            YUJI
          </AppText>
          <AppText variant="caption">GO SOMEWHERE</AppText>
        </View>
      </View>
      {/* Leaderboard and Notifications buttons go here once those features exist */}
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
    gap: Spacing.two,
  },
});
