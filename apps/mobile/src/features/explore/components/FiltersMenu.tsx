import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';
import type { CategoryFilter } from '../types';

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
            {active && <MaterialCommunityIcons name="check" size={22} color={colors.coral} />}
          </Pressable>
        );
      })}
      <View style={styles.actions}>
        <Pressable style={styles.reset} onPress={() => onApply('all')}>
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
        <Pressable style={styles.apply} onPress={() => onApply(pending)}>
          <Text style={styles.applyText}>Apply filters</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE5DA',
  },
  rowActive: { backgroundColor: '#F3F6F1' },
  label: { fontSize: 17, color: colors.text },
  labelActive: { fontWeight: '700', color: colors.forest },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  reset: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  resetText: { fontSize: 16, fontWeight: '600', color: colors.forest },
  apply: {
    flex: 2.3,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.forest,
  },
  applyText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
