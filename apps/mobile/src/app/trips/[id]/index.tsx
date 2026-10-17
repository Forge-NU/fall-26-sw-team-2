import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import type { PostResponse, TripResponse } from '@/api/types';
import { DayPosts } from '@/components/trips/day-posts';
import { TripError, TripLoading } from '@/components/trips/trip-states';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pill, type PillState } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { IconButton, ScreenHeader } from '@/components/ui/screen-header';
import { Palette } from '@/constants/palette';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTrip, useTripPosts } from '@/hooks/use-trips';
import { useCurrentUser } from '@/lib/current-user';
import { isActiveTrip } from '@/lib/trips';
import { todayLocalIso } from '@/utils/local-date';
import {
  formatDate,
  formatDateRange,
  formatWeekdayDate,
  tripDayCount,
  tripDayNumber,
  tripDays,
} from '@/utils/trip-dates';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const posts = useTripPosts(id);
  const user = useCurrentUser();

  const isOwner = trip.data?.owner.id === user.id;

  return (
    <Screen>
      <ScreenHeader
        left={{ icon: 'arrow-back', label: 'Back', onPress: () => router.back() }}
        right={
          isOwner ? (
            <IconButton
              icon="create-outline"
              label="Edit trip"
              onPress={() => router.push({ pathname: '/trips/[id]/edit', params: { id } })}
            />
          ) : null
        }
      />
      {trip.isPending || posts.isPending ? (
        <TripLoading />
      ) : trip.isError || posts.isError ? (
        <TripError
          error={trip.error ?? posts.error}
          onRetry={() => {
            void trip.refetch();
            void posts.refetch();
          }}
        />
      ) : (
        <TripBody
          trip={trip.data}
          posts={posts.data}
          isOwner={isOwner}
          refreshing={trip.isRefetching || posts.isRefetching}
          onRefresh={() => {
            void trip.refetch();
            void posts.refetch();
          }}
        />
      )}
    </Screen>
  );
}

type TripBodyProps = {
  trip: TripResponse;
  posts: PostResponse[];
  isOwner: boolean;
  refreshing: boolean;
  onRefresh: () => void;
};

function TripBody({ trip, posts, isOwner, refreshing, onRefresh }: TripBodyProps) {
  const today = todayLocalIso();
  const days = tripDays(trip.startDate, trip.endDate);
  const active = isActiveTrip(trip, today);
  const [selectedDay, setSelectedDay] = useState(() => defaultDay(trip, posts, today));
  // The trip's dates can change under the selection after an edit
  const day = days.includes(selectedDay) ? selectedDay : days[0];
  const dayPosts = posts.filter((post) => post.visitedOn === day);
  const places = new Set(posts.map((post) => post.location?.id ?? post.customLocationName)).size;

  const addPost = () =>
    router.push({ pathname: '/posts/new', params: { tripId: trip.id, visitedOn: day } });

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.titleRow}>
          <AppText variant="heading" style={styles.title} numberOfLines={2}>
            {trip.title}
          </AppText>
          <Pill {...statusPill(trip, active, today)} />
        </View>
        <AppText variant="label" style={styles.muted}>
          {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
        </AppText>
        {trip.description ? <AppText variant="label" style={styles.description}>{trip.description}</AppText> : null}

        <Cover trip={trip} />

        {posts.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="No posts yet"
            description={
              isOwner
                ? "This trip is saved and shows as in progress on your profile. Add posts to each day, then publish when you're ready."
                : 'Nothing has been posted to this trip yet.'
            }
            style={styles.empty}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.days}>
              {days.map((date, i) => (
                <Pill
                  key={date}
                  label={`Day ${i + 1}`}
                  accessibilityLabel={`Day ${i + 1}, ${formatWeekdayDate(date)}`}
                  state={date === day ? 'selected' : 'default'}
                  onPress={() => setSelectedDay(date)}
                />
              ))}
            </ScrollView>

            <View style={styles.dayHeader}>
              <AppText variant="subheading" style={styles.flex}>
                Day {tripDayNumber(trip.startDate, day)} · {formatWeekdayDate(day)}
              </AppText>
              <AppText variant="caption" style={styles.muted}>
                {dayPosts.length === 1 ? '1 post' : `${dayPosts.length} posts`}
              </AppText>
            </View>

            {dayPosts.length > 0 ? (
              <DayPosts posts={dayPosts} />
            ) : (
              <AppText variant="label" style={[styles.muted, styles.center]}>
                Nothing on this day yet.
              </AppText>
            )}

            <AppText variant="caption" style={[styles.muted, styles.center]}>
              {tripDayCount(trip.startDate, trip.endDate)} days · {posts.length}{' '}
              {posts.length === 1 ? 'post' : 'posts'} · {places} {places === 1 ? 'place' : 'places'}
            </AppText>
          </>
        )}
      </ScrollView>

      {isOwner ? (
        <View style={styles.actions}>
          <Button title="+ Add post" onPress={addPost} style={styles.fullWidth} />
          {trip.status === 'draft' && posts.length > 0 ? (
            <Button
              title="Publish trip"
              variant="teal"
              onPress={() => router.push({ pathname: '/trips/[id]/publish', params: { id: trip.id } })}
              style={styles.fullWidth}
            />
          ) : null}
          <AppText variant="caption" style={[styles.muted, styles.center]}>
            {trip.status === 'published'
              ? `Published ${formatDate(trip.publishedAt!.slice(0, 10))}. Everyone can see this trip.`
              : posts.length === 0
                ? 'Add at least one post to publish this trip.'
                : 'Only you can see this trip until you publish it.'}
          </AppText>
        </View>
      ) : null}
    </>
  );
}

// Wireframe 02 has a trip map here. Until the map tickets land, it's the cover
// photo, or a placeholder with the destination.
function Cover({ trip }: { trip: TripResponse }) {
  if (trip.coverImageUrl) {
    return (
      <Image
        source={{ uri: trip.coverImageUrl }}
        style={styles.cover}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`${trip.title} cover photo`}
      />
    );
  }
  return (
    <View style={[styles.cover, styles.coverEmpty]}>
      <Ionicons name="map-outline" size={24} color={Palette.teal} />
      <AppText variant="caption" style={styles.muted}>
        {trip.destination}
      </AppText>
    </View>
  );
}

function statusPill(trip: TripResponse, active: boolean, today: string): { label: string; state: PillState } {
  if (trip.status === 'published') return { label: 'Published', state: 'default' };
  if (active) {
    const day = tripDayNumber(trip.startDate, today);
    return { label: `Day ${day} of ${tripDayCount(trip.startDate, trip.endDate)}`, state: 'live' };
  }
  return { label: 'In progress', state: 'default' };
}

// Today on an active trip, otherwise the first day with posts
function defaultDay(trip: TripResponse, posts: PostResponse[], today: string): string {
  if (isActiveTrip(trip, today)) return today;
  return posts[0]?.visitedOn ?? trip.startDate;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.three, paddingBottom: Spacing.four },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  muted: { color: Palette.placeholderGray },
  description: { fontFamily: Typography.body.fontFamily },
  center: { textAlign: 'center' },
  cover: { width: '100%', height: 140, borderRadius: Radii.medium },
  coverEmpty: {
    backgroundColor: Palette.lightTeal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  empty: { alignSelf: 'center' },
  days: { gap: 6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two },
  fullWidth: { width: '100%' },
});
