import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AddToTripSheet } from '@/components/itinerary/add-to-trip-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Palette, Radii } from '@/constants/theme';
import type { DayPlace } from '@/data/mock';

/** Bottom panel listing a day's stops, each addable to the viewer's own itinerary. */
export function DayAtAGlance({ places }: { places: DayPlace[] }) {
  // Mock only: nothing is persisted yet.
  const [added, setAdded] = useState<Set<string>>(new Set());
  // Places waiting on a trip choice in the "Add to a trip" sheet.
  const [pending, setPending] = useState<string[] | null>(null);
  const allAdded = places.length > 0 && places.every((place) => added.has(place.id));

  const remove = (id: string) =>
    setAdded((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  return (
    <View style={styles.panel}>
      <View style={styles.intro}>
        <AppText variant="heading">
          The day, at a glance
        </AppText>
        <View style={styles.stopCount}>
          <AppText variant="caption">
            {places.length} {places.length === 1 ? 'stop' : 'stops'}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color="placeholderGray">
        Add places to your planned itinerary.
      </AppText>

      <View style={styles.places}>
        {places.map((place) => {
          const isAdded = added.has(place.id);
          return (
            <View key={place.id} style={styles.place}>
              <View style={styles.placeHeader}>
                <View style={styles.timeChip}>
                  <AppText variant="caption">
                    {place.time}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isAdded ? `Remove ${place.name}` : `Add ${place.name}`}
                  onPress={() => (isAdded ? remove(place.id) : setPending([place.id]))}
                  style={styles.addPlace}>
                  <Icon name={isAdded ? 'check' : 'plus'} size={13} color="coral" />
                  <AppText variant="caption">
                    {isAdded ? 'Added' : 'Add'}
                  </AppText>
                </Pressable>
              </View>
              <AppText variant="label">
                {place.name}
              </AppText>
              <AppText variant="caption" color="placeholderGray">
                {place.note}
              </AppText>
            </View>
          );
        })}
      </View>

      <Button
        title={allAdded ? `All ${places.length} places added` : `Add all ${places.length} places`}
        disabled={allAdded}
        style={styles.fullWidth}
        onPress={() => setPending(places.filter((place) => !added.has(place.id)).map((place) => place.id))}
      />
      <AppText variant="caption" color="placeholderGray" style={styles.footnote}>
        Make this day part of your next trip.
      </AppText>

      <AddToTripSheet
        visible={pending !== null}
        placeCount={pending?.length ?? 0}
        onAdded={() => setAdded((current) => new Set([...current, ...(pending ?? [])]))}
        onClose={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.circle,
    backgroundColor: Palette.lightTeal,
  },
  places: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  place: {
    // Two per row, matching the 170px cards in the 390px frame.
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 88,
    gap: 6,
    padding: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.circle,
    backgroundColor: Palette.peach,
  },
  addPlace: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.small,
    backgroundColor: Palette.peach,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  footnote: {
    textAlign: 'center',
  },
});
