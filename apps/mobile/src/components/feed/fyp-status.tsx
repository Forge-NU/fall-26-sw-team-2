import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Palette, ScreenGutter } from '@/constants/theme';
import type { FypFeed } from '@/hooks/use-fyp-feed';

/** Loading, error and empty states below the FYP cards. */
export function FypStatus({ feed }: { feed: FypFeed }) {
  if (feed.status === 'loading' || feed.status === 'loadingMore') {
    return (
      <View style={styles.status}>
        <ActivityIndicator color={Palette.teal} accessibilityLabel="Loading trips" />
      </View>
    );
  }

  if (feed.status === 'error') {
    return (
      <View style={styles.status}>
        <AppText size={13} color="inkMuted">
          {"Couldn't load trips."}
        </AppText>
        <Pressable accessibilityRole="button" onPress={feed.retry} hitSlop={8}>
          <AppText variant="bold" size={13} color="coral">
            Try again
          </AppText>
        </Pressable>
      </View>
    );
  }

  if (feed.status === 'idle' && feed.itineraries.length === 0) {
    return (
      <View style={styles.status}>
        <AppText size={13} color="inkMuted">
          No trips yet. Published trips show up here.
        </AppText>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  status: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: ScreenGutter,
    paddingVertical: 32,
  },
});
