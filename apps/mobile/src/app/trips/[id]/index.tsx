import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { PostResponse, StoryResponse, TripResponse } from 'shared-types';

import { StatRow } from '@/components/content/stat-row';
import { UserRow } from '@/components/content/user-row';
import { PostDraftsBanner } from '@/components/posts/post-drafts-banner';
import { DayPosts } from '@/components/trips/day-posts';
import { DayStories } from '@/components/trips/day-stories';
import { tripErrorState } from '@/components/trips/trip-error-state';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Media } from '@/components/ui/media';
import { Pill, type PillState } from '@/components/ui/pill';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Palette } from '@/constants/palette';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTripStories } from '@/hooks/use-stories';
import { useTrip, useTripPosts } from '@/hooks/use-trips';
import { useCurrentUser } from '@/lib/current-user';
import { storiesOnDay } from '@/lib/stories';
import { isActiveTrip } from '@/lib/trips';
import {
  formatDate,
  formatDateRange,
  formatWeekdayDate,
  todayLocalIso,
  tripDayCount,
  tripDayNumber,
  tripDays,
} from '@/utils/local-date';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  const posts = useTripPosts(id);
  // Not part of loading or errors: the page works without its stories
  const stories = useTripStories(id);
  const user = useCurrentUser();

  const isOwner = trip.data?.owner.id === user.id;
  const error = trip.error ?? posts.error;
  const refetch = () => {
    void trip.refetch();
    void posts.refetch();
    void stories.refetch();
  };

  return (
    <Screen
      loading={trip.isPending || posts.isPending}
      error={error}
      onRetry={refetch}
      errorState={tripErrorState(error)}
      header={
        <ScreenHeader
          left={{ icon: 'arrow-left', label: 'Back', onPress: () => router.back() }}
          right={
            isOwner ? (
              <IconButton
                icon="pencil"
                accessibilityLabel="Edit trip"
                onPress={() => router.push({ pathname: '/trips/[id]/edit', params: { id } })}
              />
            ) : null
          }
        />
      }>
      {trip.data && posts.data ? (
        <TripBody
          trip={trip.data}
          posts={posts.data}
          stories={stories.data ?? []}
          isOwner={isOwner}
          refreshing={trip.isRefetching || posts.isRefetching}
          onRefresh={refetch}
        />
      ) : null}
    </Screen>
  );
}

type TripBodyProps = {
  trip: TripResponse;
  posts: PostResponse[];
  /** Kept stories ("Add to trip"), including ones that left the stories bar */
  stories: StoryResponse[];
  isOwner: boolean;
  refreshing: boolean;
  onRefresh: () => void;
};

function TripBody({ trip, posts, stories, isOwner, refreshing, onRefresh }: TripBodyProps) {
  const today = todayLocalIso();
  const days = tripDays(trip.startDate, trip.endDate);
  const active = isActiveTrip(trip, today);
  // Null until the user picks a day, so the default can use stories that load after the page
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const fallbackDay = defaultDay(trip, posts, stories, today);
  // The trip's dates can change under the selection after an edit
  const day = [selectedDay, fallbackDay].find((d): d is string => d !== null && days.includes(d)) ?? days[0];
  const dayPosts = posts.filter((post) => post.visitedOn === day);
  const dayStories = storiesOnDay(stories, day);
  const places = new Set(posts.map((post) => post.location?.id ?? post.customLocationName)).size;

  const addPost = () =>
    router.push({ pathname: '/posts/new', params: { tripId: trip.id, visitedOn: day } });

  const dayCount = tripDayCount(trip.startDate, trip.endDate);
  // Likes and saves join these once INT-3 (#51) lands
  const stats = [
    { key: 'posts', label: posts.length === 1 ? 'post' : 'posts', count: posts.length },
    { key: 'places', label: places === 1 ? 'place' : 'places', count: places },
    { key: 'days', label: dayCount === 1 ? 'day' : 'days', count: dayCount },
  ];

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
        {/* Not tappable yet: profiles live inside the Profile tab, and this page is
            outside the tabs, so linking there either stacks a second tab bar or
            closes this page. Needs profiles pushable from any screen first. */}
        <UserRow user={trip.owner} />
        <AppText variant="label" style={styles.muted}>
          {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
        </AppText>
        {trip.description ? <AppText variant="label" style={styles.description}>{trip.description}</AppText> : null}
        <StatRow items={stats} />

        {isOwner ? <PostDraftsBanner tripId={trip.id} /> : null}

        <Cover trip={trip} />

        {posts.length === 0 && stories.length === 0 ? (
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

            {dayStories.length > 0 ? <DayStories tripId={trip.id} day={day} stories={dayStories} /> : null}

            {dayPosts.length > 0 ? (
              <DayPosts posts={dayPosts} />
            ) : dayStories.length > 0 ? null : (
              <AppText variant="label" style={[styles.muted, styles.center]}>
                Nothing on this day yet.
              </AppText>
            )}
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
          {trip.status === 'published' || posts.length === 0 ? (
            <AppText variant="caption" style={[styles.muted, styles.center]}>
              {trip.status === 'published'
                ? `Published ${formatDate(trip.publishedAt!.slice(0, 10))}. Everyone can see this trip.`
                : 'Add at least one post to publish this trip.'}
            </AppText>
          ) : null}
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
      <View accessible accessibilityRole="image" accessibilityLabel={`${trip.title} cover photo`}>
        <Media seed={trip.id} url={trip.coverImageUrl} style={styles.cover} />
      </View>
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

// Today on an active trip, otherwise the first day with posts or stories
function defaultDay(trip: TripResponse, posts: PostResponse[], stories: StoryResponse[], today: string): string {
  if (isActiveTrip(trip, today)) return today;
  const firstDays = [posts[0]?.visitedOn, stories[0]?.storyDate].filter((d): d is string => Boolean(d));
  return firstDays.sort()[0] ?? trip.startDate;
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
  days: { gap: Spacing.two },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { gap: Spacing.two },
  fullWidth: { width: '100%' },
});
