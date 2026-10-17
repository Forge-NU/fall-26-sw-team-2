import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';

export type PillState = 'default' | 'selected' | 'live';

export type PillProps = {
  label: string;
  state?: PillState;
  showPin?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const variants = {
  default: { background: Palette.white, border: Palette.peach, text: Palette.placeholderGray },
  selected: { background: Palette.peach, border: Palette.coral, text: Palette.coral },
  live: { background: Palette.lightTeal, border: Palette.teal, text: Palette.black },
} as const;

// Pill from the trip wireframes: day tabs, places and status badges
export function Pill({ label, state = 'default', showPin = false, onPress, accessibilityLabel }: PillProps) {
  const colors = variants[state];

  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={onPress ? { selected: state === 'selected' } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: colors.background, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      {showPin ? <Ionicons name="location-outline" size={12} color={colors.text} /> : null}
      <AppText variant="caption" style={{ color: colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: Spacing.one,
  },
  pressed: { opacity: 0.7 },
});
