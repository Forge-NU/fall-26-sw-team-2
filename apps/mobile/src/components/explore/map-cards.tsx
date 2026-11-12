import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ShadowTokens } from '@/constants/shadow-tokens';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import type { AroundItem } from '@/hooks/use-explore';

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
        <MaterialCommunityIcons name="account-multiple-outline" size={30} color={Palette.black} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-up'} size={26} color={Palette.black} />
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
                <MaterialCommunityIcons name="star" size={14} color={Palette.coral} />
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
  card: { padding: Spacing.three, borderRadius: Radii.pill, backgroundColor: Palette.white, ...ShadowTokens.floating },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1, gap: Spacing.half },
  title: { ...Typography.subheading, color: Palette.black },
  subtitle: { ...Typography.label, fontFamily: Typography.body.fontFamily, color: Palette.placeholderGray },
  list: { marginTop: Spacing.three, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: Palette.peach },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.two },
  rowName: { flex: 1, ...Typography.body, color: Palette.black },
  rowRating: { ...Typography.label, color: Palette.black },
});
