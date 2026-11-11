import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PostLikerResponse } from 'shared-types';

import { ApiError } from '@/api/client';
import { listPostLikes } from '@/api/engagement';
import { getMyProfile } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { ListEmpty, ListFooter } from '@/components/content/list-states';
import { UserRow } from '@/components/content/user-row';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { BottomTabInset, Palette, Spacing } from '@/constants/theme';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { toggleFollow } from '@/lib/engagement';
import { engagementKeys, uniqueById } from '@/lib/engagement-cache';

/** Who liked a post, newest first, with a follow button on everyone but you. */
export function PostLikesView({ postId }: { postId: string }) {
  const me = useQuery({ queryKey: queryKeys.myProfile, queryFn: ({ signal }) => getMyProfile(signal) });
  const likers = useInfiniteList<PostLikerResponse>({
    queryKey: engagementKeys.likes(postId),
    fetchPage: (cursor, signal) => listPostLikes(postId, cursor, signal),
  });
  const deleted = likers.error instanceof ApiError && likers.error.status === 404;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.bar}>
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/saved'))}
        />
        <AppText variant="heading" accessibilityRole="header">
          Likes
        </AppText>
      </View>
      {deleted ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Post no longer available"
          description="It may have been deleted."
          style={styles.centered}
        />
      ) : (
        <FlatList
          data={uniqueById(likers.items)}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => <LikerRow user={item} isMe={item.id === me.data?.id} />}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={<ListEmpty list={likers} icon="heart-outline" title="No likes yet" />}
          ListFooterComponent={<ListFooter list={likers} />}
          onEndReached={likers.loadMore}
          onEndReachedThreshold={0.5}
          refreshing={likers.isRefetching && !likers.isFetchingNextPage}
          onRefresh={() => void likers.refetch()}
          contentContainerStyle={styles.content}
        />
      )}
    </SafeAreaView>
  );
}

function LikerRow({ user, isMe }: { user: PostLikerResponse; isMe: boolean }) {
  return (
    <UserRow
      user={user}
      subtitle={isMe ? 'You' : undefined}
      action={
        isMe
          ? undefined
          : {
              title: user.isFollowing ? 'Following' : 'Follow',
              variant: user.isFollowing ? 'teal' : 'coral',
              onPress: () => toggleFollow(user),
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  centered: { alignSelf: 'center', marginTop: Spacing.five },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.peach, marginVertical: Spacing.two },
});
