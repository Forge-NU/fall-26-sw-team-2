import { router } from 'expo-router';
import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { FeedItem } from 'shared-types';

import { tripStats } from '@/components/content/engagement-stats';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { TripCard } from '@/components/content/trip-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { YujiHeader } from '@/components/yuji-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useFeed } from '@/hooks/use-feed';
import { useCurrentUser } from '@/lib/current-user';
import { shareTrip } from '@/lib/share-trip';

/**
 * The home feed (#27 FEED-2): published trips from people you follow, newest
 * first, under the stories bar (#25). Friends is the only feed in the MVP, so
 * there's no tab row (FEED-02 in the v2 wireframes). Local and FYP come back
 * post-MVP (#118); useFeed already takes the feed type. The tab keeps its
 * screen and cached pages when you leave it, so coming back keeps your place.
 */
export default function FeedScreen() {
  const feed = useFeed('friends');
  const renderItem = useCallback(({ item }: { item: FeedItem }) => <FeedCard item={item} />, []);

  return (
    <Screen edges={['top']} gutters={false} header={<YujiHeader />}>
      <FlatList
        data={feed.items}
        keyExtractor={(item) => item.trip.id}
        renderItem={renderItem}
        ListHeaderComponent={<StoriesRow />}
        ListHeaderComponentStyle={styles.header}
        ListEmptyComponent={
          // ListEmpty for the skeletons and the load error only, so its empty
          // title is never shown; the feed's empty state has a button
          feed.isPending || feed.isError ? (
            <View style={styles.gutter}>
              <ListEmpty list={feed} cards title="" />
            </View>
          ) : (
            <EmptyState
              icon="people-outline"
              title="Follow some travelers"
              description="When people you follow share trips, they show up here."
              action={{ title: 'Find people', onPress: () => router.navigate('/maps') }}
              style={styles.empty}
            />
          )
        }
        ListFooterComponent={<ListFooter list={feed} />}
        ItemSeparatorComponent={Separator}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshing={feed.isRefetching && !feed.isFetchingNextPage}
        onRefresh={() => void feed.refetch()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// Memoized so loading another page doesn't re-render the cards already shown
const FeedCard = memo(function FeedCard({ item }: { item: FeedItem }) {
  const { trip, posts } = item;
  const currentUser = useCurrentUser();
  // `visitedOn` (YYYY-MM-DD) opens the trip page on that day's tab
  const openTrip = (day?: string) =>
    router.push({ pathname: '/trips/[id]', params: day ? { id: trip.id, day } : { id: trip.id } });
  const openOwner = () => {
    if (trip.owner.id === currentUser.id) router.navigate('/profile');
    else router.push({ pathname: '/users/[id]', params: { id: trip.owner.id } });
  };

  return (
    <View style={styles.gutter}>
      <TripCard
        trip={trip}
        posts={posts}
        stats={tripStats(trip)}
        onPress={() => openTrip()}
        onDayPress={openTrip}
        onUserPress={openOwner}
        onShare={() => shareTrip(trip)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.three,
  },
  content: {
    flexGrow: 1,
    paddingTop: Spacing.two + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  gutter: {
    paddingHorizontal: Spacing.three,
  },
  separator: {
    height: Spacing.three,
  },
  empty: {
    alignSelf: 'center',
    marginTop: Spacing.five,
  },
});
