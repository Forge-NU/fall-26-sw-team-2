import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { ListFooter } from '@/components/content/list-states';
import { NotificationRow, NotificationSkeletons } from '@/components/notifications/notification-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Palette, Spacing } from '@/constants/theme';
import { useMarkAllReadOnOpen, useNotifications } from '@/hooks/use-notifications';
import { isShownNotification } from '@/lib/notifications';

// The inbox behind the header's bell (#137 NOTIF-2). Opening it marks
// everything as read (#129 DOC-3).
export default function NotificationsScreen() {
  const markAllRead = useMarkAllReadOnOpen();
  const list = useNotifications();
  const rows = list.items.filter(isShownNotification);

  const openTrip = (id: string) => router.push({ pathname: '/trips/[id]', params: { id } });
  const refresh = async () => {
    // Load first, so rows that just arrived still show as unread
    await list.refetch();
    markAllRead();
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title="Notifications"
          left={{
            icon: 'arrow-left',
            label: 'Back',
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
          }}
        />
      }
      loading={list.isPending}
      loadingFallback={<NotificationSkeletons />}
      error={list.data ? null : list.error}
      onRetry={() => void list.refetch()}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow notification={item} unread={!item.readAt} onOpenTrip={openTrip} />}
        ItemSeparatorComponent={Separator}
        // In the list rather than Screen's `empty`, so pull to refresh still works
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              description="Trip invites, and people joining your trips, show up here."
            />
          </View>
        }
        ListFooterComponent={<ListFooter list={list} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void refresh()}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: Spacing.three },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.peach, marginVertical: Spacing.three },
});
