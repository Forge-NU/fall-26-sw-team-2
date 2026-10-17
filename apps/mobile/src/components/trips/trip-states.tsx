import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { describeError } from '@/lib/api-errors';

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
  const gone = describeError(error, '') === "This trip doesn't exist anymore.";
  return (
    <View style={styles.center}>
      <EmptyState
        icon={gone ? 'map-outline' : 'cloud-offline-outline'}
        title={gone ? 'Trip not found' : "Couldn't load this trip"}
        description={describeError(error, 'Something went wrong. Try again.')}
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
