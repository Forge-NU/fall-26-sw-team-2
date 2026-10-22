import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../theme';
import type { AroundItem } from '../useExplore';

interface AroundProps {
  title: string;
  subtitle: string;
  items: AroundItem[];
  onSelect: (item: AroundItem) => void;
}

/** "Around Lisbon" card. Expands to show the highest-rated spots in view. */
export function AroundCard({ title, subtitle, items, onSelect }: AroundProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.header}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <MaterialCommunityIcons name="account-multiple-outline" size={30} color={colors.text} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-up'} size={26} color={colors.text} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          {items.length === 0 ? (
            <Text style={styles.subtitle}>Nothing rated here yet. Try Global.</Text>
          ) : (
            items.map((it) => (
              <Pressable key={it.key} style={styles.row} onPress={() => onSelect(it)}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {it.name}
                </Text>
                <MaterialCommunityIcons name="star" size={14} color={colors.star} />
                <Text style={styles.rowRating}>{it.rating.toFixed(1)}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 19, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  list: { marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  rowName: { flex: 1, fontSize: 16, color: colors.text },
  rowRating: { fontSize: 15, fontWeight: '700', color: colors.forest },
});
