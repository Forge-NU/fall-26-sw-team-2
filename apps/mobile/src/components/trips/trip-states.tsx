import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ApiError, getErrorMessage } from '@/api/client';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { TRIP_ERROR_FALLBACKS } from '@/lib/trips';

export function TripLoading() {
  return (
    <View style={styles.loading} accessibilityLabel="Loading trip">
      <Skeleton height={28} width="60%" />
      <Skeleton height={140} />
      <Skeleton height={24} width="80%" />
      <Skeleton height={44} />
      <Skeleton height={44} />
    </View>
  );
}

export function TripError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const gone = error instanceof ApiError && error.status === 404;
  return (
    <View style={styles.center}>
      <EmptyState
        icon={gone ? 'map-outline' : 'cloud-offline-outline'}
        title={gone ? 'Trip not found' : "Couldn't load this trip"}
        description={gone ? TRIP_ERROR_FALLBACKS[404] : getErrorMessage(error, TRIP_ERROR_FALLBACKS)}
        action={
          gone
            ? { title: 'Go back', onPress: () => router.back() }
            : { title: 'Try again', onPress: onRetry }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: Spacing.three },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
