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

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/icon';
import { Palette, Radii, Typography } from '@/constants/theme';
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
          placeholderTextColor={Palette.placeholderGray}
          style={styles.input}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Icon name="x" size={14} />
          </Pressable>
        )}
      </View>

      <AppText variant="caption" color="placeholderGray">
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
              <Icon name="map-pin" size={20} color={selected ? 'coral' : 'black'} />
              <View style={styles.resultDetails}>
                <AppText variant="caption">
                  {place.name}
                </AppText>
                <AppText variant="caption" color="placeholderGray">
                  {place.detail}
                </AppText>
              </View>
              <View style={styles.resultMeta}>
                <AppText variant="caption" color="placeholderGray">
                  {place.distance}
                </AppText>
                {selected && <Icon name="check" size={16} color="coral" />}
              </View>
            </Pressable>
          );
        })}
        {results.length === 0 && (
          <AppText variant="caption" color="placeholderGray">
            No places match “{query}”.
          </AppText>
        )}
      </View>

      {value && (
        <View style={styles.selected}>
          <AppText variant="caption">
            SELECTED LOCATION
          </AppText>
          <AppText variant="caption">
            {value.name}
          </AppText>
          <AppText variant="caption" color="placeholderGray">
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
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Palette.lightPink,
  },
  input: {
    flex: 1,
    fontFamily: Typography.body.fontFamily,
    fontSize: 12,
    color: Palette.black,
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
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  resultSelected: {
    borderColor: Palette.coral,
    backgroundColor: Palette.peach,
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
    borderRadius: Radii.small,
    backgroundColor: Palette.lightTeal,
  },
});
