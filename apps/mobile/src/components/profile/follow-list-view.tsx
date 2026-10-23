import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { followListFetchers, getMe, getProfile, type FollowList, type FollowListUser } from '@/api/profiles';
import { UserRow } from '@/components/content/user-row';
import { AppText } from '@/components/ui/app-text';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useFollow } from '@/hooks/use-follow';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { profileKeys, uniqueById } from '@/lib/follow-cache';
import { ListEmpty, ListFooter } from './list-states';
import { BackBar } from './profile-view';

type FollowListViewProps = {
  userId: string;
  list: FollowList;
  /** Passed by the profile that opened the list, so the title shows before the profile loads */
  username?: string;
};

/** "Followers (8)" or "Following (16)", with a follow button on everyone but you. */
export function FollowListView({ userId, list, username }: FollowListViewProps) {
  const me = useQuery({ queryKey: profileKeys.me, queryFn: ({ signal }) => getMe(signal) });
  const isOwn = userId === me.data?.id;
  const other = useQuery({
    queryKey: profileKeys.profile(userId),
    queryFn: ({ signal }) => getProfile(userId, signal),
    enabled: me.isFetched && !isOwn,
  });
  const profile = isOwn ? me.data : other.data;
  const people = useInfiniteList<FollowListUser>({
    queryKey: profileKeys.followList(userId, list),
    fetchPage: (cursor, signal) => followListFetchers[list](userId, cursor, signal),
  });

  const count = profile && (list === 'followers' ? profile.followerCount : profile.followingCount);
  const title = list === 'followers' ? 'Followers' : 'Following';
  const handle = profile?.username ?? username;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <BackBar title={handle ? `@${handle}` : undefined} />
      <FlatList
        data={uniqueById(people.items)}
        keyExtractor={(user) => user.id}
        renderItem={({ item }) => <FollowRow user={item} isMe={item.id === me.data?.id} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <AppText variant="heading" accessibilityRole="header" style={styles.title}>
            {title}
            {count !== undefined ? ` (${count})` : ''}
          </AppText>
        }
        ListEmptyComponent={
          <ListEmpty
            list={people}
            icon="people-outline"
            title={list === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          />
        }
        ListFooterComponent={<ListFooter list={people} />}
        onEndReached={people.loadMore}
        onEndReachedThreshold={0.5}
        refreshing={people.isRefetching}
        onRefresh={() => void people.refetch()}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

function FollowRow({ user, isMe }: { user: FollowListUser; isMe: boolean }) {
  const { toggle } = useFollow(user.id);
  return (
    <UserRow
      user={user}
      onPress={() =>
        isMe ? router.navigate('/profile') : router.push({ pathname: '/profile/users/[id]', params: { id: user.id } })
      }
      action={
        isMe
          ? undefined
          : {
              title: user.isFollowing ? 'Following' : 'Follow',
              variant: user.isFollowing ? 'teal' : 'coral',
              onPress: () => toggle(user.isFollowing),
            }
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite },
  content: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, flexGrow: 1 },
  title: { paddingVertical: Spacing.two },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.peach, marginVertical: Spacing.two },
});
