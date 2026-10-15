import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Palette, Radius } from '@/constants/theme';
import type { DayPlace } from '@/data/mock';

/** Bottom panel listing a day's stops, each addable to the viewer's own itinerary. */
export function DayAtAGlance({ places }: { places: DayPlace[] }) {
  // Mock only: nothing is persisted yet.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const allAdded = places.length > 0 && places.every((place) => added.has(place.id));

  const toggle = (id: string) =>
    setAdded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={styles.panel}>
      <View style={styles.intro}>
        <AppText variant="display" size={20}>
          The day, at a glance
        </AppText>
        <View style={styles.stopCount}>
          <AppText variant="bold" size={11}>
            {places.length} {places.length === 1 ? 'stop' : 'stops'}
          </AppText>
        </View>
      </View>
      <AppText size={11} color="inkMuted" leading={1.3}>
        Add places to your planned itinerary.
      </AppText>

      <View style={styles.places}>
        {places.map((place) => {
          const isAdded = added.has(place.id);
          return (
            <View key={place.id} style={styles.place}>
              <View style={styles.placeHeader}>
                <View style={styles.timeChip}>
                  <AppText variant="bold" size={10}>
                    {place.time}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isAdded ? `Remove ${place.name}` : `Add ${place.name}`}
                  onPress={() => toggle(place.id)}
                  style={styles.addPlace}>
                  <Icon name={isAdded ? 'check' : 'plus'} size={13} color="coral" />
                  <AppText variant="bold" size={10}>
                    {isAdded ? 'Added' : 'Add'}
                  </AppText>
                </Pressable>
              </View>
              <AppText variant="bold" size={13} leading={1.2}>
                {place.name}
              </AppText>
              <AppText size={10} color="inkMuted" leading={1.2}>
                {place.note}
              </AppText>
            </View>
          );
        })}
      </View>

      <ActionButton
        label={allAdded ? `All ${places.length} places added` : `Add all ${places.length} places`}
        leadingIcon={allAdded ? 'check' : 'plus'}
        height={40}
        fontSize={12}
        disabled={allAdded}
        onPress={() => setAdded(new Set(places.map((place) => place.id)))}
      />
      <AppText size={10} color="inkMuted" style={styles.footnote}>
        Make this day part of your next trip.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stopCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.tealSoft,
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
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Palette.coralBorder,
    backgroundColor: Palette.surface,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.coralSoft,
  },
  addPlace: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Palette.coralSoft,
  },
  footnote: {
    textAlign: 'center',
  },
});
