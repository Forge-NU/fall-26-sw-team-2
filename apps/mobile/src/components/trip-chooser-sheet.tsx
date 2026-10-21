import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { Palette, Radii } from '@/constants/theme';
import type { ActiveTrip } from '@/data/mock';
import { formatRange } from '@/utils/dates';

type TripChooserSheetProps = {
  visible: boolean;
  title?: string;
  trips: ActiveTrip[];
  selectedId: string | null;
  onSelect: (tripId: string) => void;
  /** Status line under each trip's dates. */
  describe: (trip: ActiveTrip) => string;
  /** Shows the "Post without a trip" row when provided. */
  onPostWithoutTrip?: () => void;
  onCreateTrip: () => void;
  onClose: () => void;
};

/** Pick one of your trips. Used by the story composer and by "Add places to itinerary". */
export function TripChooserSheet({
  visible,
  title = 'Choose a trip',
  trips,
  selectedId,
  onSelect,
  describe,
  onPostWithoutTrip,
  onCreateTrip,
  onClose,
}: TripChooserSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
        <View style={styles.trips}>
          {trips.map((trip) => {
            const selected = trip.id === selectedId;
            return (
              <Pressable
                key={trip.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onSelect(trip.id)}
                style={[styles.trip, selected && styles.tripSelected]}>
                <Icon name="calendar-days" size={22} />
                <View style={styles.tripDetails}>
                  <AppText variant="label">
                    {trip.title}
                  </AppText>
                  <AppText variant="caption" color="placeholderGray">
                    {formatRange(trip.startDate, trip.endDate)} · {trip.status}
                  </AppText>
                  <AppText variant="caption" color="placeholderGray">
                    {describe(trip)}
                  </AppText>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {onPostWithoutTrip && (
          <Pressable
            accessibilityRole="button"
            onPress={onPostWithoutTrip}
            style={styles.withoutTrip}>
            <Icon name="circle-minus" size={20} />
            <AppText variant="caption" style={styles.grow}>
              Post without a trip
            </AppText>
            <Icon name="chevron-right" />
          </Pressable>
        )}

        <Pressable accessibilityRole="button" onPress={onCreateTrip} style={styles.createTrip}>
          <View style={styles.createSymbol}>
            <Icon name="plus" size={20} color="coral" />
          </View>
          <AppText variant="caption" style={styles.grow}>
            Create trip
          </AppText>
          <Icon name="chevron-right" />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 12,
  },
  trips: {
    gap: 8,
  },
  trip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  tripSelected: {
    borderColor: Palette.coral,
    backgroundColor: Palette.peach,
  },
  tripDetails: {
    flex: 1,
    gap: 4,
  },
  withoutTrip: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Palette.lightPink,
  },
  createTrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: Radii.circle,
    borderWidth: 1.5,
    borderColor: Palette.placeholderGray,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.warmWhite,
  },
  radioSelected: {
    borderColor: Palette.coral,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: Radii.circle,
    backgroundColor: Palette.coral,
  },
  createSymbol: {
    width: 32,
    height: 32,
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.peach,
  },
});
