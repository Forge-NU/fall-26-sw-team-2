import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TripError, TripLoading } from '@/components/trips/trip-states';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/components/ui/toast-provider';
import { Palette } from '@/constants/palette';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { usePublishTrip, useTrip, useTripPosts } from '@/hooks/use-trips';
import { describeError } from '@/lib/api-errors';
import { tripDayCount } from '@/utils/trip-dates';

const PREVIEW_COUNT = 8;

// Wireframe 06, minus the visibility picker and feed-preview choice, which
// DOC-1 doesn't have: everything is public once published.
export default function PublishTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const posts = useTripPosts(id);
  const publish = usePublishTrip(id);
  const { showToast } = useToast();

  let body;
  if (trip.isPending || posts.isPending) {
    body = <TripLoading />;
  } else if (trip.isError || posts.isError) {
    body = (
      <TripError
        error={trip.error ?? posts.error}
        onRetry={() => {
          void trip.refetch();
          void posts.refetch();
        }}
      />
    );
  } else {
    const days = tripDayCount(trip.data.startDate, trip.data.endDate);
    const postCount = posts.data.length;
    const places = new Set(posts.data.map((post) => post.location?.id ?? post.customLocationName)).size;
    const photos = posts.data.flatMap((post) => post.media).slice(0, PREVIEW_COUNT);
    const published = trip.data.status === 'published';

    body = (
      <>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <AppText variant="subheading" style={styles.center}>
            {trip.data.title}
          </AppText>
          <AppText variant="caption" style={[styles.muted, styles.center]}>
            {days} {days === 1 ? 'day' : 'days'} · {postCount} {postCount === 1 ? 'post' : 'posts'} · {places}{' '}
            {places === 1 ? 'place' : 'places'}
          </AppText>

          <AppText variant="caption" style={[styles.muted, styles.center]}>
            Feed preview
          </AppText>
          <View style={styles.grid}>
            {Array.from({ length: PREVIEW_COUNT }, (_, i) =>
              photos[i] ? (
                <Image key={photos[i].id} source={{ uri: photos[i].url }} style={styles.tile} contentFit="cover" />
              ) : (
                <View key={`empty-${i}`} style={[styles.tile, styles.tileEmpty]} />
              ),
            )}
          </View>

          <View style={styles.notice}>
            <Ionicons name="earth-outline" size={18} color={Palette.coral} />
            <AppText variant="label" style={styles.noticeText}>
              Once it&apos;s published, everyone can see this trip and all its posts: in feeds, on your
              profile, on the map and in search. You can keep editing and adding posts, but you can&apos;t
              unpublish it.
            </AppText>
          </View>

          {postCount === 0 ? (
            <AppText variant="label" style={[styles.error, styles.center]}>
              Add at least one post before publishing.
            </AppText>
          ) : null}
          {publish.error ? (
            <AppText variant="label" accessibilityLiveRegion="polite" style={[styles.error, styles.center]}>
              {describeError(publish.error, "Couldn't publish the trip. Try again.")}
            </AppText>
          ) : null}
        </ScrollView>

        <Button
          title={published ? 'Already published' : 'Publish trip'}
          disabled={published || postCount === 0}
          loading={publish.isPending}
          onPress={() =>
            publish.mutate(undefined, {
              onSuccess: () => {
                showToast({ message: 'Trip published', variant: 'success' });
                router.back();
              },
            })
          }
          style={styles.fullWidth}
        />
      </>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Publish trip"
        left={{ icon: 'arrow-back', label: 'Back', onPress: () => router.back() }}
      />
      {body}
    </Screen>
  );
}

const GRID_GAP = 6;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.two, paddingBottom: Spacing.four },
  center: { textAlign: 'center' },
  muted: { color: Palette.placeholderGray },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginVertical: Spacing.one },
  tile: {
    width: `${(100 - 3 * 2) / 4}%`,
    aspectRatio: 1,
    borderRadius: Radii.small,
  },
  tileEmpty: { backgroundColor: Palette.peach },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    borderRadius: Radii.small,
    backgroundColor: Palette.white,
  },
  noticeText: { flex: 1, fontFamily: Typography.body.fontFamily },
  error: { color: Palette.coral },
  fullWidth: { width: '100%' },
});
