import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PostResponse, TripResponse } from 'shared-types';

import { getErrorMessage } from '@/api/client';
import { getFollowStatus, getMyProfile, getProfile, listUserPosts, listUserTrips } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { EmptyState } from '@/components/ui/empty-state';
import { Media } from '@/components/ui/media';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TabBar } from '@/components/ui/tab-bar';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useCurrentUser, useSignOut } from '@/lib/current-user';
import { uniqueById } from '@/lib/follow-cache';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { ProfileHeader, ProfileHeaderSkeleton } from './profile-header';
import { TripRow } from './trip-row';

type ProfileTab = 'itineraries' | 'posts';

// Saved isn't here yet: it only said "coming soon", and your saves are on the
// Saved tab for now (UI-4 #98). DOC-1 puts them on your own profile.
const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'itineraries', label: 'Itineraries' },
  { key: 'posts', label: 'Posts' },
];

/**
 * A profile: header, then Itineraries / Posts.
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

  const newTrip = () => router.push('/trips/new');
  const backBar = routeUserId ? (
    <BackBar />
  ) : (
    <View style={styles.topBar}>
      <ScreenHeader
        left={signOut ? { icon: 'log-out', label: 'Sign out', onPress: () => void signOut() } : undefined}
        right={<IconButton icon="plus" accessibilityLabel="New trip" onPress={newTrip} />}
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
          isOwn={isOwn}
        />
      ) : (
        <ProfileHeaderSkeleton />
      )}
      <TabBar items={TABS} value={tab} onChange={setTab} />
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
            <View style={styles.rowWrap}>
              <ListEmpty
                list={posts}
                icon="images-outline"
                title="No posts yet"
                description={isOwn ? 'Photos you add to a trip show up here.' : undefined}
              />
            </View>
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
          data={uniqueById(trips.items)}
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
            <View style={styles.rowWrap}>
              <ListEmpty
                list={trips}
                icon="map-outline"
                title="No itineraries yet"
                description={isOwn ? 'Trips you start show up here, drafts included.' : undefined}
              />
            </View>
          }
          ListFooterComponent={<ListFooter list={trips} />}
          onEndReached={trips.loadMore}
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

// The same ScreenHeader as the trip pages: back arrow, centered title, actions
export function BackBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <ScreenHeader
        title={title}
        left={{
          icon: 'arrow-left',
          label: 'Back',
          onPress: onBack ?? (() => (router.canGoBack() ? router.back() : router.navigate('/profile'))),
        }}
        right={right}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  centered: { alignSelf: 'center', marginTop: Spacing.six },
  content: { paddingBottom: BottomTabInset + Spacing.four, flexGrow: 1 },
  rowWrap: { paddingHorizontal: Spacing.three },
  headerBlock: { gap: Spacing.three, padding: Spacing.three },
  separator: { height: Spacing.two },
  gridRow: { gap: Spacing.half },
  gridCell: { flex: 1, aspectRatio: 1, marginBottom: Spacing.half },
  topBar: { paddingHorizontal: Spacing.three },
});
