import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShadowTokens } from '@/constants/shadow-tokens';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import type { Audience } from '@/components/explore/types';

const OPTIONS: { value: Audience; label: string }[] = [
  { value: 'me', label: 'Me' },
  { value: 'friends', label: 'Friends' },
  { value: 'global', label: 'Global' },
];

interface Props {
  value: Audience;
  onChange: (value: Audience) => void;
}

export function AudienceToggle({ value, onChange }: Props) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    width: '74%',
    padding: Spacing.one,
    borderRadius: Radii.circle,
    backgroundColor: Palette.white,
    ...ShadowTokens.floating,
  },
  segment: {
    flex: 1,
    minHeight: Spacing.five + Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.circle,
  },
  // Same as the active day on the itinerary page
  segmentActive: { backgroundColor: Palette.black },
  label: { ...Typography.label, color: Palette.placeholderGray },
  labelActive: { color: Palette.warmWhite },
});
