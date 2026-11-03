import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TripResponse } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Palette } from '@/constants/palette';
import { MaxContentWidth, Radii, Spacing, Theme } from '@/constants/theme';
import { formatDateRange } from '@/utils/trip-dates';

export type TripSelectProps = {
  trip: TripResponse | null;
  subtitle: string;
  trips: TripResponse[];
  loading: boolean;
  disabled?: boolean;
  onChange: (trip: TripResponse) => void;
  onCreateTrip: () => void;
};

// "Trip" card from the Add posts wireframe. Tapping it switches trips.
export function TripSelect({ trip, subtitle, trips, loading, disabled, onChange, onCreateTrip }: TripSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={trip ? `Trip: ${trip.title}, ${subtitle}. Change trip` : 'Choose a trip'}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.cardText}>
          <AppText variant="label" numberOfLines={1} style={styles.title}>
            {trip?.title ?? 'Choose a trip'}
          </AppText>
          {trip ? (
            <AppText variant="caption" numberOfLines={1} style={styles.secondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {loading ? (
          <ActivityIndicator color={Palette.coral} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={Palette.black} />
        )}
      </Pressable>
      {open ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
          onRequestClose={() => setOpen(false)}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.sheet}>
            <View style={styles.sheetContent}>
              <ScreenHeader
                title="Choose trip"
                left={{ icon: 'close', label: 'Close', onPress: () => setOpen(false) }}
              />
              <FlatList
                data={trips}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                  loading ? (
                    <ActivityIndicator color={Palette.coral} />
                  ) : (
                    <EmptyState
                      icon="airplane-outline"
                      title="No trips yet"
                      description="Posts live in a trip. Create one first."
                      action={{
                        title: 'New trip',
                        onPress: () => {
                          setOpen(false);
                          onCreateTrip();
                        },
                      }}
                    />
                  )
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.id === trip?.id }}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      item.id === trip?.id && styles.rowSelected,
                      pressed && styles.pressed,
                    ]}>
                    <View style={styles.cardText}>
                      <AppText variant="label" numberOfLines={1}>
                        {item.title}
                      </AppText>
                      <AppText variant="caption" numberOfLines={1} style={styles.secondary}>
                        {formatDateRange(item.startDate, item.endDate)} · {item.destination}
                      </AppText>
                    </View>
                    <Pill
                      label={item.status === 'published' ? 'Published' : 'Draft'}
                      state={item.status === 'published' ? 'live' : 'default'}
                    />
                  </Pressable>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: 10,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Palette.peach,
    backgroundColor: Palette.peach,
  },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: Theme.typography.supporting.fontFamily },
  secondary: { color: Palette.placeholderGray },
  sheet: { flex: 1, backgroundColor: Theme.colors.background },
  sheetContent: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  list: { gap: Spacing.two, paddingBottom: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three - Spacing.one,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: Palette.peach,
    backgroundColor: Palette.white,
  },
  rowSelected: { borderColor: Palette.coral, backgroundColor: Palette.peach },
  pressed: { opacity: 0.7 },
});
