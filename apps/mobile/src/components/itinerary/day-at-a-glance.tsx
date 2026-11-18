import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radii } from '@/constants/theme';
import type { DayPlace } from '@/data/mock';

/**
 * Bottom panel listing a day's stops. The Add buttons are hidden until adding
 * places to your own trip is real (UI-4 #98): they only showed a success toast.
 */
export function DayAtAGlance({ places }: { places: DayPlace[] }) {
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

      <View style={styles.places}>
        {places.map((place) => (
          <View key={place.id} style={styles.place}>
            <View style={styles.placeHeader}>
              <View style={styles.timeChip}>
                <AppText variant="caption">
                  {place.time}
                </AppText>
              </View>
            </View>
            <AppText variant="label">
              {place.name}
            </AppText>
            <AppText variant="caption" color="placeholderGray">
              {place.note}
            </AppText>
          </View>
        ))}
      </View>
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
});
