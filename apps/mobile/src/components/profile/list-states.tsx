import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';

import { getErrorMessage } from '@/api/client';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Spacing } from '@/constants/theme';
import type { useInfiniteList } from '@/hooks/use-infinite-list';

type List = Pick<
  ReturnType<typeof useInfiniteList<unknown>>,
  'isPending' | 'isError' | 'error' | 'refetch' | 'isFetchingNextPage' | 'isFetchNextPageError' | 'fetchNextPage'
>;

type EmptyProps = {
  list: List;
  title: string;
  description?: string;
  icon?: ComponentProps<typeof EmptyState>['icon'];
};

/** What a profile list shows with no rows: skeletons, the first-load error, or empty. */
export function ListEmpty({ list, title, description, icon }: EmptyProps) {
  if (list.isPending) {
    return (
      <View style={styles.skeletons}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton circle width={40} height={40} />
            <Skeleton width="60%" />
          </View>
        ))}
      </View>
    );
  }
  if (list.isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load this"
        description={getErrorMessage(list.error)}
        action={{ title: 'Try again', onPress: () => void list.refetch() }}
        style={styles.centered}
      />
    );
  }
  return <EmptyState icon={icon} title={title} description={description} style={styles.centered} />;
}

/** Spinner while the next page loads, or a retry after it fails. */
export function ListFooter({ list }: { list: List }) {
  if (list.isFetchingNextPage) {
    return <ActivityIndicator color={Palette.coral} style={styles.footer} />;
  }
  if (list.isFetchNextPageError) {
    return (
      <View style={styles.footer}>
        <AppText variant="caption" color="placeholderGray">
          {getErrorMessage(list.error)}
        </AppText>
        <Button title="Load more" variant="teal" size="compact" onPress={() => void list.fetchNextPage()} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  skeletons: { gap: Spacing.three, padding: Spacing.three },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  centered: { alignSelf: 'center', marginTop: Spacing.five },
  footer: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
});
