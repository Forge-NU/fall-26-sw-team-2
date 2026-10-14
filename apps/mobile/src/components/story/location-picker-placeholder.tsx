/**
 * PLACEHOLDER for the LocationPicker from POST-2.
 *
 * POST-2's component isn't in the repo yet. This stand-in renders the Figma
 * "Add a location" body against mock places so the story composer can be
 * built end to end. When POST-2 lands, swap this for the real LocationPicker
 * in `location-sheet.tsx` and delete this file. Keep the `value` / `onChange`
 * contract, or adapt the sheet to whatever POST-2 exposes.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { FontFamily, Palette, Radius } from '@/constants/theme';
import { NearbyPlaces, type NearbyPlace } from '@/data/mock';

type LocationPickerPlaceholderProps = {
  value: NearbyPlace | null;
  onChange: (place: NearbyPlace | null) => void;
};

export function LocationPickerPlaceholder({ value, onChange }: LocationPickerPlaceholderProps) {
  const [query, setQuery] = useState('Miradouro, Lisbon');
  const terms = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  const results = NearbyPlaces.filter((place) => {
    const haystack = `${place.name} ${place.detail}`.toLowerCase();
    // Match any term so "Miradouro, Lisbon" still surfaces the castle in Lisbon.
    return terms.length === 0 || terms.some((term) => haystack.includes(term));
  });

  return (
    <View style={styles.content}>
      <View style={styles.search}>
        <Icon name="search" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search places"
          placeholderTextColor={Palette.disabled}
          style={styles.input}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Icon name="clear-14" />
          </Pressable>
        )}
      </View>

      <AppText size={11} color="inkMuted" leading={1.35}>
        Places near your photo · Lisbon
      </AppText>

      <View style={styles.results}>
        {results.map((place) => {
          const selected = place.id === value?.id;
          return (
            <Pressable
              key={place.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(place)}
              style={[styles.result, selected && styles.resultSelected]}>
              <Icon name={selected ? 'map-pin-coral' : 'map-pin-dark'} />
              <View style={styles.resultDetails}>
                <AppText variant="bold" size={11} leading={1.35}>
                  {place.name}
                </AppText>
                <AppText size={9} color="inkMuted" leading={1.35}>
                  {place.detail}
                </AppText>
              </View>
              <View style={styles.resultMeta}>
                <AppText size={9} color="inkMuted" leading={1.35}>
                  {place.distance}
                </AppText>
                {selected && <Icon name="check-coral" />}
              </View>
            </Pressable>
          );
        })}
        {results.length === 0 && (
          <AppText size={11} color="inkMuted">
            No places match “{query}”.
          </AppText>
        )}
      </View>

      {value && (
        <View style={styles.selected}>
          <AppText variant="bold" size={9} leading={1.35}>
            SELECTED LOCATION
          </AppText>
          <AppText variant="bold" size={12} leading={1.35}>
            {value.name}
          </AppText>
          <AppText size={10} color="inkMuted" leading={1.35}>
            Optional
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Palette.ink,
    paddingVertical: 0,
  },
  results: {
    gap: 8,
  },
  result: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  resultSelected: {
    borderColor: Palette.coral,
    backgroundColor: Palette.coralSoft,
  },
  resultDetails: {
    flex: 1,
    gap: 4,
  },
  resultMeta: {
    alignItems: 'flex-end',
    gap: 5,
  },
  selected: {
    gap: 4,
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Palette.tealSoft,
  },
});
