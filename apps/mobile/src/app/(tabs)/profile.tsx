// STAND-IN for PROF-1 (#31): a bare version of the profile trips grid in the
// profile tab, so there's a way into the trip screens and deletes can be seen
// to drop out of the list. The real profile screen replaces it.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { TripResponse } from '@/api/types';
import { TripError } from '@/components/trips/trip-states';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { IconButton, ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import { useMyTrips } from '@/hooks/use-trips';
import { formatDateRange } from '@/utils/trip-dates';

export default function ProfileScreen() {
  const trips = useMyTrips();
  const newTrip = () => router.push('/trips/new');

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="My trips"
        right={<IconButton icon="add" label="New trip" onPress={newTrip} />}
      />
      {trips.isPending ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={190} style={styles.cell} />
          ))}
        </View>
      ) : trips.isError ? (
        <TripError error={trips.error} onRetry={() => void trips.refetch()} />
      ) : (
        <FlatList
          data={trips.data}
          keyExtractor={(trip) => trip.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshing={trips.isRefetching}
          onRefresh={() => void trips.refetch()}
          renderItem={({ item }) => <TripTile trip={item} />}
          ListEmptyComponent={
            <EmptyState
              icon="airplane-outline"
              title="No trips yet"
              description="Make a trip, then add posts to it as you go."
              action={{ title: 'New trip', onPress: newTrip }}
              style={styles.empty}
            />
          }
        />
      )}
    </Screen>
  );
}

function TripTile({ trip }: { trip: TripResponse }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}, ${trip.status === 'draft' ? 'in progress' : 'published'}`}
      onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
      {trip.coverImageUrl ? (
        <Image source={{ uri: trip.coverImageUrl }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.coverEmpty]}>
          <AppText variant="caption" style={styles.muted}>
            No posts yet
          </AppText>
        </View>
      )}
      {trip.status === 'draft' ? (
        <View style={styles.badge}>
          <Pill label="In progress" />
        </View>
      ) : null}
      <AppText variant="label" numberOfLines={1}>
        {trip.title}
      </AppText>
      <AppText variant="caption" numberOfLines={1} style={styles.muted}>
        {formatDateRange(trip.startDate, trip.endDate)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, paddingBottom: Spacing.three, flexGrow: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  row: { gap: Spacing.three },
  cell: { flex: 1, maxWidth: '48%', gap: Spacing.one },
  cover: { width: '100%', aspectRatio: 4 / 5, borderRadius: Radii.medium },
  coverEmpty: { backgroundColor: Palette.peach, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: Spacing.two, left: Spacing.two },
  muted: { color: Palette.placeholderGray },
  empty: { alignSelf: 'center', marginTop: Spacing.six },
  pressed: { opacity: 0.7 },
});
