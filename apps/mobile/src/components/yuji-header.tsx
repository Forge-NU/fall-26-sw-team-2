import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { IconButton } from '@/components/ui/icon-button';
import { Material } from '@/components/ui/material';
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

export type YujiHeaderProps = {
  /** Shows a + next to the bell: the backup for when the Post tab can't open the sheet (#160 option B) */
  onPost?: () => void;
};

// The feed's nav header: the wordmark and the bell, on the frosted material
export function YujiHeader({ onPost }: YujiHeaderProps) {
  return (
    <Material edge="bottom" style={styles.header}>
      <YujiLogo />
      <View style={styles.actions}>
        {onPost ? <IconButton icon="plus" accessibilityLabel="Post" onPress={onPost} /> : null}
        <NotificationBell />
      </View>
    </Material>
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
