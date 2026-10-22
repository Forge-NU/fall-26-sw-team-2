import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';
import type { KindFilter, ResultKind, SearchResult } from '../types';

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'place', label: 'Places' },
  { value: 'destination', label: 'Destinations' },
  { value: 'activity', label: 'Things to do' },
];

const ICON: Record<ResultKind, keyof typeof MaterialCommunityIcons.glyphMap> = {
  destination: 'web',
  place: 'map-marker-outline',
  activity: 'tram',
};

interface Props {
  query: string;
  results: SearchResult[];
  filter: KindFilter;
  onFilterChange: (f: KindFilter) => void;
  onSelect: (result: SearchResult) => void;
}

export function SearchResults({ query, results, filter, onFilterChange, onSelect }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            Results for “{query.trim()}”
          </Text>
          <Text style={styles.count}>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Pressable
                key={f.value}
                onPress={() => onFilterChange(f.value)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <Text style={styles.empty}>No matches. Try a city or neighborhood, or switch to Global.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onSelect(item)}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons name={ICON[item.kind]} size={24} color={colors.forest} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
              <Text style={styles.stats} numberOfLines={1}>
                {item.statsLine}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
          </Pressable>
        )}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  count: { fontSize: 14, color: colors.textMuted },
  chips: { gap: 8, paddingVertical: 14 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.peachLine,
    backgroundColor: colors.peach,
  },
  chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { fontSize: 15, color: colors.text },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  rowPressed: { opacity: 0.6 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sageIcon,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted },
  stats: { fontSize: 14, color: colors.text },
  sep: { height: 1, backgroundColor: colors.line },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 20, lineHeight: 20 },
});
