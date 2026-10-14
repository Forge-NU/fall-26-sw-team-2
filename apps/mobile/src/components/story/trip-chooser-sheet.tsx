import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { Palette, Radius } from '@/constants/theme';
import type { ActiveTrip } from '@/data/mock';
import { formatRange } from '@/utils/dates';

type TripChooserSheetProps = {
  visible: boolean;
  trips: ActiveTrip[];
  selectedId: string | null;
  onSelect: (tripId: string | null) => void;
  onCreateTrip: () => void;
  onClose: () => void;
};

export function TripChooserSheet({
  visible,
  trips,
  selectedId,
  onSelect,
  onCreateTrip,
  onClose,
}: TripChooserSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Choose a trip">
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
                <Icon name="calendar-days-22" />
                <View style={styles.tripDetails}>
                  <AppText variant="bold" size={13} leading={1.35}>
                    {trip.title}
                  </AppText>
                  <AppText size={11} color="inkMuted" leading={1.35}>
                    {formatRange(trip.startDate, trip.endDate)} · {trip.status}
                  </AppText>
                  <AppText variant="bold" size={9} color="inkMuted">
                    {trip.suggested ? 'Suggested · active today' : 'Active today'}
                  </AppText>
                </View>
                <Icon name={selected ? 'radio-on' : 'radio-off'} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => onSelect(null)}
          style={styles.withoutTrip}>
          <Icon name="minus-circle" />
          <AppText variant="bold" size={12} leading={1.35} style={styles.grow}>
            Post without a trip
          </AppText>
          <Icon name="chevron-right" />
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onCreateTrip} style={styles.createTrip}>
          <Icon name="create-trip" />
          <AppText variant="bold" size={12} leading={1.35} style={styles.grow}>
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  tripSelected: {
    borderColor: Palette.coral,
    backgroundColor: Palette.coralSoft,
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
    borderColor: Palette.border,
  },
  createTrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  grow: {
    flex: 1,
  },
});
