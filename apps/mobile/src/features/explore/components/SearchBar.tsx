import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, shadow } from '../theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  filtersHighlighted: boolean;
  onPressFilters: () => void;
}

export function SearchBar({ value, onChangeText, filtersHighlighted, onPressFilters }: Props) {
  return (
    <View style={styles.bar}>
      <MaterialCommunityIcons name="magnify" size={26} color={colors.coral} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Search places, trips, things to do"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <MaterialCommunityIcons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      )}
      <View style={styles.divider} />
      <Pressable
        onPress={onPressFilters}
        style={[styles.filters, filtersHighlighted && styles.filtersOn]}
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersHighlighted }}
      >
        <Text style={[styles.filtersText, filtersHighlighted && styles.filtersTextOn]}>Filters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: 16,
    paddingRight: 6,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  divider: { width: 1, height: 28, backgroundColor: colors.line },
  filters: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.sage,
  },
  filtersOn: { backgroundColor: colors.forest },
  filtersText: { fontSize: 15, fontWeight: '700', color: colors.forest },
  filtersTextOn: { color: '#FFFFFF' },
});
