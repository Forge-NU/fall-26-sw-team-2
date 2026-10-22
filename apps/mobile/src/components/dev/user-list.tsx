import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { UserResponse } from 'shared-types';

import { getErrorMessage } from '@/api/client';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Spacing } from '@/constants/theme';
import type { useInfiniteList } from '@/hooks/use-infinite-list';

type UserListProps = {
  list: ReturnType<typeof useInfiniteList<UserResponse>>;
};

/**
 * Every state an infinite list needs: first load, first-load error, empty,
 * loading more, a failed page, the end, and pull to refresh.
 */
export function UserList({ list }: UserListProps) {
  if (list.isPending) {
    return (
      <View style={styles.list}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton circle width={32} height={32} />
            <Skeleton width="60%" />
          </View>
        ))}
      </View>
    );
  }

  if (list.isError && list.items.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load the list"
        description={getErrorMessage(list.error)}
        action={{ title: 'Try again', onPress: () => void list.refetch() }}
        style={styles.centered}
      />
    );
  }

  return (
    <FlatList
      data={list.items}
      keyExtractor={(user) => user.id}
      renderItem={({ item }) => <UserRow user={item} />}
      contentContainerStyle={styles.list}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      ListEmptyComponent={<EmptyState icon="people-outline" title="No one here yet" style={styles.centered} />}
      ListFooterComponent={<ListFooter list={list} />}
    />
  );
}

function ListFooter({ list }: UserListProps) {
  if (list.isFetchingNextPage) {
    return <ActivityIndicator color={Palette.coral} style={styles.footer} />;
  }
  if (list.isFetchNextPageError) {
    return (
      <View style={styles.footer}>
        <AppText variant="caption" color="placeholderGray">
          {getErrorMessage(list.error)}
        </AppText>
        <Button title="Load more" variant="teal" onPress={() => void list.fetchNextPage()} />
      </View>
    );
  }
  if (!list.hasNextPage && list.items.length > 0) {
    return (
      <AppText variant="caption" color="placeholderGray" style={styles.end}>
        {`That's everyone · ${list.items.length} loaded`}
      </AppText>
    );
  }
  return null;
}

function UserRow({ user }: { user: UserResponse }) {
  const name = `${user.firstName} ${user.lastName}`;
  return (
    <View style={styles.row}>
      <Avatar name={name} uri={user.avatarUrl} size="small" />
      <View>
        <AppText variant="label">{name}</AppText>
        <AppText variant="caption" color="placeholderGray">
          @{user.username}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.three, padding: Spacing.three, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  centered: { alignSelf: 'center', marginTop: Spacing.six },
  footer: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  end: { textAlign: 'center', paddingVertical: Spacing.three },
});
