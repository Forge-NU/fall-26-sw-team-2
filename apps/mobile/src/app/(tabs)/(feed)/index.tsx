import { router } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { FeedItem, FeedType } from 'shared-types';

import { tripStats } from '@/components/content/engagement-stats';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { TripCard } from '@/components/content/trip-card';
import { StoriesRow } from '@/components/feed/stories-row';
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { YujiHeader } from '@/components/yuji-header';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useFeed } from '@/hooks/use-feed';
import { useCurrentUser } from '@/lib/current-user';
import { shareTrip } from '@/lib/share-trip';

type FeedTab = FeedType | 'fyp';

// The same three tabs as before FEED-2. Friends is the MVP feed and opens
// first. Local and FYP are post-MVP (#118): Local asks the API, which returns
// an empty page for now, and FYP has no endpoint yet.
const FeedTabs: { key: FeedTab; label: string }[] = [
  { key: 'local', label: 'Local' },
  { key: 'friends', label: 'Friends' },
  { key: 'fyp', label: 'FYP' },
];

const EMPTY: Record<FeedTab, EmptyStateProps> = {
  friends: {
    icon: 'people-outline',
    title: 'Follow some travelers',
    description: 'When people you follow share trips, they show up here.',
    action: { title: 'Find people', onPress: () => router.navigate('/maps') },
  },
  local: {
    icon: 'location-outline',
    title: 'Local is coming soon',
    description: 'Trips from travelers near you will show up here.',
  },
  fyp: {
    icon: 'sparkles-outline',
    title: 'For You is coming soon',
    description: 'Trips picked for you will show up here.',
  },
};

/**
 * The home feed (#27 FEED-2): trip cards under the stories bar (#25). The tab
 * keeps its screen and cached pages when you leave it, so coming back keeps
 * your place.
 */
export default function FeedScreen() {
  const [tab, setTab] = useState<FeedTab>('friends');

  return (
    <Screen
      edges={['top']}
      gutters={false}
      header={
        <View>
          <YujiHeader />
          <View style={styles.gutter}>
            <TabBar items={FeedTabs} value={tab} onChange={setTab} />
          </View>
        </View>
      }>
      {tab === 'fyp' ? <ComingSoon /> : <FeedList key={tab} type={tab} />}
    </Screen>
  );
}

function FeedList({ type }: { type: FeedType }) {
  const feed = useFeed(type);
  const renderItem = useCallback(({ item }: { item: FeedItem }) => <FeedCard item={item} />, []);

  return (
    <FlatList
      data={feed.items}
      keyExtractor={(item) => item.trip.id}
      renderItem={renderItem}
      ListHeaderComponent={<StoriesRow />}
      ListHeaderComponentStyle={styles.header}
      ListEmptyComponent={
        // ListEmpty for the skeletons and the load error only, so its empty
        // title is never shown; each tab has its own empty state
        feed.isPending || feed.isError ? (
          <View style={styles.gutter}>
            <ListEmpty list={feed} cards title="" />
          </View>
        ) : (
          <EmptyState {...EMPTY[type]} style={styles.empty} />
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
  );
}

// FYP until #118 gives it an endpoint
function ComingSoon() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <StoriesRow />
      </View>
      <EmptyState {...EMPTY.fyp} style={styles.empty} />
    </ScrollView>
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
