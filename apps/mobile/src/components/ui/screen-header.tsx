import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/palette';
import { Spacing } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

export type ScreenHeaderProps = {
  title?: string;
  left?: HeaderAction;
  right?: ReactNode;
};

// Top bar from the trip wireframes: icon on the left, centered title, actions on the right
export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {left ? <IconButton {...left} /> : null}
      </View>
      <AppText variant="subheading" numberOfLines={1} accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

export function IconButton({ icon, label, onPress }: HeaderAction) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <Ionicons name={icon} size={ICON_SIZE} color={Palette.black} />
    </Pressable>
  );
}

const ICON_SIZE = 22;

const styles = StyleSheet.create({
  row: {
    minHeight: 32 + Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  side: {
    minWidth: ICON_SIZE * 2 + Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
