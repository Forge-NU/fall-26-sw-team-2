import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PostResponse, TripResponse } from 'shared-types';

import { getErrorMessage } from '@/api/client';
import { getFollowStatus, getMyProfile, getProfile, listUserPosts, listUserTrips } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { Media } from '@/components/ui/media';
import { IconButton, ScreenHeader } from '@/components/ui/screen-header';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useCurrentUser, useSignOut } from '@/lib/current-user';
import { uniqueById } from '@/lib/follow-cache';
import { ListEmpty, ListFooter } from './list-states';
import { ProfileHeader, ProfileHeaderSkeleton } from './profile-header';
import { TripRow } from './trip-row';

type ProfileTab = 'itineraries' | 'posts' | 'saved';

const TAB_LABELS: Record<ProfileTab, string> = { itineraries: 'Itineraries', posts: 'Posts', saved: 'Saved' };

/**
 * A profile: header, then Itineraries / Posts (and Saved on your own).
 * Without `userId` it's the signed-in user's own profile tab.
 */
export function ProfileView({ userId: routeUserId }: { userId?: string }) {
  const [tab, setTab] = useState<ProfileTab>('itineraries');
  const currentUser = useCurrentUser();
  const signOut = useSignOut();
  // Opening your own profile from a list still counts as your own
  const isOwn = !routeUserId || routeUserId === currentUser.id;
  const userId = isOwn ? currentUser.id : routeUserId;

  const profileQuery = useQuery({
    queryKey: isOwn ? queryKeys.myProfile : queryKeys.profile(userId),
    queryFn: ({ signal }) => (isOwn ? getMyProfile(signal) : getProfile(userId, signal)),
  });
  const followStatus = useQuery({
    queryKey: queryKeys.followStatus(userId),
    queryFn: ({ signal }) => getFollowStatus(userId, signal),
    enabled: !isOwn,
  });

  const trips = useInfiniteList<TripResponse>({
    queryKey: queryKeys.userTripPages(userId),
    fetchPage: (cursor, signal) => listUserTrips(userId, cursor, signal),
    enabled: tab === 'itineraries',
  });
  const posts = useInfiniteList<PostResponse>({
    queryKey: queryKeys.userPosts(userId),
    fetchPage: (cursor, signal) => listUserPosts(userId, cursor, signal),
    enabled: tab === 'posts',
  });

  const tabs: ProfileTab[] = isOwn ? ['itineraries', 'posts', 'saved'] : ['itineraries', 'posts'];
  const newTrip = () => router.push('/trips/new');
  const backBar = routeUserId ? (
    <BackBar />
  ) : (
    <View style={styles.topBar}>
      <ScreenHeader
        left={signOut ? { icon: 'log-out-outline', label: 'Sign out', onPress: () => void signOut() } : undefined}
        right={<IconButton icon="add" label="New trip" onPress={newTrip} />}
      />
    </View>
  );

  if (profileQuery.isError && !profileQuery.data) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        {backBar}
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this profile"
          description={getErrorMessage(profileQuery.error)}
          action={{ title: 'Try again', onPress: () => void profileQuery.refetch() }}
          style={styles.centered}
        />
      </SafeAreaView>
    );
  }

  const header = (
    <View style={styles.headerBlock}>
      {profileQuery.data ? (
        <ProfileHeader
          profile={profileQuery.data}
          isFollowing={isOwn ? null : (followStatus.data?.isFollowing ?? null)}
        />
      ) : (
        <ProfileHeaderSkeleton />
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((key) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={styles.tab}>
              <AppText variant="label" color={active ? 'black' : 'placeholderGray'}>
                {TAB_LABELS[key]}
              </AppText>
              {active && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const refresh = () => {
    void profileQuery.refetch();
    if (!isOwn) void followStatus.refetch();
    void (tab === 'posts' ? posts : trips).refetch();
  };
  const refreshing = profileQuery.isRefetching;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {backBar}
      {tab === 'posts' ? (
        <FlatList
          key="posts"
          data={uniqueById(posts.items)}
          keyExtractor={(post) => post.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <Media
              seed={item.id}
              url={item.media.find((media) => media.mediaType === 'image')?.url}
              style={styles.gridCell}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <ListEmpty
              list={posts}
              icon="images-outline"
              title="No posts yet"
              description={isOwn ? 'Photos you add to a trip show up here.' : undefined}
            />
          }
          ListFooterComponent={<ListFooter list={posts} />}
          onEndReached={posts.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={refresh}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="list"
          data={tab === 'itineraries' ? uniqueById(trips.items) : []}
          keyExtractor={(trip) => trip.id}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <TripRow
                trip={item}
                onPress={() => router.push({ pathname: '/trips/[id]', params: { id: item.id } })}
              />
            </View>
          )}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          ListEmptyComponent={
            tab === 'saved' ? (
              // INT-3 (#51) fills this in
              <EmptyState
                icon="bookmark-outline"
                title="Saved trips are coming soon"
                description="Itineraries you save will live here."
                style={styles.centered}
              />
            ) : (
              <ListEmpty
                list={trips}
                icon="map-outline"
                title="No itineraries yet"
                description={isOwn ? 'Trips you start show up here, drafts included.' : undefined}
              />
            )
          }
          ListFooterComponent={tab === 'itineraries' ? <ListFooter list={trips} /> : undefined}
          onEndReached={tab === 'itineraries' ? trips.loadMore : undefined}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={refresh}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

export function BackBar({ title }: { title?: string }) {
  return (
    <View style={styles.backBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={Spacing.two}
        onPress={() => (router.canGoBack() ? router.back() : router.navigate('/profile'))}>
        <Icon name="chevron-left" size={Spacing.four} />
      </Pressable>
      {title ? (
        <AppText variant="label" numberOfLines={1} style={styles.backTitle}>
          {title}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  centered: { alignSelf: 'center', marginTop: Spacing.six },
  content: { paddingBottom: BottomTabInset + Spacing.four, flexGrow: 1 },
  rowWrap: { paddingHorizontal: Spacing.three },
  headerBlock: { gap: Spacing.three, padding: Spacing.three },
  tabs: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Palette.lightPink,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: Palette.teal },
  separator: { height: Spacing.two },
  gridRow: { gap: Spacing.half },
  gridCell: { flex: 1, aspectRatio: 1, marginBottom: Spacing.half },
  topBar: { paddingHorizontal: Spacing.three },
  backBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  backTitle: { flex: 1 },
});
