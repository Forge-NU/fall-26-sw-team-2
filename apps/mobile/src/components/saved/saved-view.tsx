import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PostResponse, TripResponse } from 'shared-types';

import { listSavedPosts, listSavedTrips } from '@/api/engagement';
import { postStats, tripStats } from '@/components/content/engagement-stats';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { PostCard } from '@/components/content/post-card';
import { TripCard } from '@/components/content/trip-card';
import { SavedPlacesList } from '@/components/saved/saved-places-list';
import { AppText } from '@/components/ui/app-text';
import { YujiHeader } from '@/components/yuji-header';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { engagementKeys, uniqueById, type SaveTarget } from '@/lib/engagement-cache';

// Places are saved on the device from the Maps tab (#81), not through the API
type SavedTab = SaveTarget | 'place';

const SavedTabs: { key: SavedTab; label: string }[] = [
  { key: 'trip', label: 'Trips' },
  { key: 'post', label: 'Posts' },
  { key: 'place', label: 'Places' },
];

/** Your saved trips, posts and places. Only you can see them: the API has no route to anyone else's. */
export function SavedView() {
  const [activeTab, setActiveTab] = useState<SavedTab>('trip');

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <YujiHeader />
      <View style={styles.tabs} accessibilityRole="tablist">
        {SavedTabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setActiveTab(tab.key)}
              style={styles.tab}>
              <AppText variant="label" color={active ? 'black' : 'placeholderGray'}>
                {tab.label}
              </AppText>
              {active && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>
      {activeTab === 'trip' && <SavedTrips />}
      {activeTab === 'post' && <SavedPosts />}
      {activeTab === 'place' && <SavedPlacesList />}
    </SafeAreaView>
  );
}

/**
 * Unsaving marks the list stale without refetching, so the item stays put
 * while you're looking at it. Coming back to the tab drops it.
 */
function useRefetchOnFocus(target: SaveTarget) {
  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey: engagementKeys.savedList(target),
        stale: true,
        // The first load is already on its way
        predicate: (query) => query.state.status === 'success',
      });
    }, [queryClient, target]),
  );
}

function SavedTrips() {
  const trips = useInfiniteList<TripResponse>({
    queryKey: engagementKeys.savedList('trip'),
    fetchPage: listSavedTrips,
  });
  useRefetchOnFocus('trip');

  return (
    <FlatList
      data={uniqueById(trips.items)}
      keyExtractor={(trip) => trip.id}
      renderItem={({ item }) => <TripCard trip={item} stats={tripStats(item)} />}
      ListHeaderComponent={<Intro />}
      ListEmptyComponent={
        <ListEmpty
          list={trips}
          cards
          icon="bookmark-outline"
          title="No saved trips yet"
          description="Tap the bookmark on a trip to keep it here."
        />
      }
      ListFooterComponent={<ListFooter list={trips} />}
      onEndReached={trips.loadMore}
      onEndReachedThreshold={0.5}
      refreshing={trips.isRefetching && !trips.isFetchingNextPage}
      onRefresh={() => void trips.refetch()}
      contentContainerStyle={styles.content}
    />
  );
}

function SavedPosts() {
  const posts = useInfiniteList<PostResponse>({
    queryKey: engagementKeys.savedList('post'),
    fetchPage: listSavedPosts,
  });
  useRefetchOnFocus('post');

  return (
    <FlatList
      data={uniqueById(posts.items)}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          stats={postStats(item)}
          onLikesPress={() =>
            router.push({ pathname: '/saved/posts/[id]/likes', params: { id: item.id } })
          }
        />
      )}
      ListHeaderComponent={<Intro />}
      ListEmptyComponent={
        <ListEmpty
          list={posts}
          cards
          icon="bookmark-outline"
          title="No saved posts yet"
          description="Tap the bookmark on a post to keep it here."
        />
      }
      ListFooterComponent={<ListFooter list={posts} />}
      onEndReached={posts.loadMore}
      onEndReachedThreshold={0.5}
      refreshing={posts.isRefetching && !posts.isFetchingNextPage}
      onRefresh={() => void posts.refetch()}
      contentContainerStyle={styles.content}
    />
  );
}

function Intro() {
  return (
    <AppText variant="caption" color="placeholderGray" style={styles.intro}>
      Only you can see what you&apos;ve saved.
    </AppText>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.warmWhite,
  },
  tabs: {
    minHeight: Spacing.five + Spacing.three,
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.lightPink,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Spacing.half,
    backgroundColor: Palette.teal,
  },
  intro: {
    paddingTop: Spacing.three,
  },
  content: {
    flexGrow: 1,
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
