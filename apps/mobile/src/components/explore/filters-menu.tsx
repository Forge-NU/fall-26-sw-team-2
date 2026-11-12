import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ShadowTokens } from '@/constants/shadow-tokens';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import type { CategoryFilter } from '@/components/explore/types';

const OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'food', label: 'Food & restaurants' },
  { value: 'hotels', label: 'Hotels' },
  { value: 'sightseeing', label: 'Sightseeing' },
  { value: 'activities', label: 'Activities' },
];

interface Props {
  value: CategoryFilter;
  onApply: (value: CategoryFilter) => void;
}

export function FiltersMenu({ value, onApply }: Props) {
  const [pending, setPending] = useState(value);

  return (
    <View style={styles.menu}>
      {OPTIONS.map((o) => {
        const active = o.value === pending;
        return (
          <Pressable
            key={o.value}
            onPress={() => setPending(o.value)}
            style={[styles.row, active && styles.rowActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            {active && <MaterialCommunityIcons name="check" size={22} color={Palette.coral} />}
          </Pressable>
        );
      })}
      <View style={styles.actions}>
        <Button title="Reset" variant="teal" onPress={() => onApply('all')} style={styles.reset} />
        <Button title="Apply filters" filled onPress={() => onApply(pending)} style={styles.apply} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    padding: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: Palette.warmWhite,
    borderWidth: 1,
    borderColor: Palette.peach,
    ...ShadowTokens.floating,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    minHeight: Spacing.six - Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Palette.peach,
  },
  rowActive: { backgroundColor: Palette.peach },
  label: { ...Typography.body, color: Palette.black },
  labelActive: { fontFamily: Typography.label.fontFamily },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  reset: { flex: 1, minWidth: 0 },
  apply: { flex: 2, minWidth: 0 },
});
