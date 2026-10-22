import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';
import type { Audience } from '../types';

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
    padding: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow,
  },
  segment: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.forest },
  label: { fontSize: 15, fontWeight: '500', color: colors.textMuted },
  labelActive: { color: '#FFFFFF', fontWeight: '700' },
});
