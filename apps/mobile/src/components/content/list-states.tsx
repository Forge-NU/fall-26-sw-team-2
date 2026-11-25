import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { getErrorMessage } from "@/api/client";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Palette, Spacing } from "@/constants/theme";
import type { useInfiniteList } from "@/hooks/use-infinite-list";

// The same states as #84's profile lists, so the two can share this once it merges

type List = Pick<
  ReturnType<typeof useInfiniteList<unknown>>,
  | "isPending"
  | "isError"
  | "error"
  | "refetch"
  | "isFetchingNextPage"
  | "isFetchNextPageError"
  | "fetchNextPage"
>;

type ListEmptyProps = {
  /** Leave off for lists that don't load, like places saved on the device */
  list?: List;
  title: string;
  description?: string;
  icon?: ComponentProps<typeof EmptyState>["icon"];
  /** Card-sized skeletons rather than user rows */
  cards?: boolean;
};

/** What a list shows with no rows: skeletons, the first-load error, or empty. */
export function ListEmpty({ list, title, description, icon, cards }: ListEmptyProps) {
  if (list?.isPending) {
    return (
      <View style={styles.skeletons}>
        {[0, 1, 2].map((i) =>
          cards ? (
            <Skeleton key={i} height={Spacing.six * 4} />
          ) : (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton circle width={Spacing.five + Spacing.two} height={Spacing.five + Spacing.two} />
              <Skeleton width="60%" />
            </View>
          ),
        )}
      </View>
    );
  }
  if (list?.isError) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load this"
        description={getErrorMessage(list.error)}
        action={{ title: "Try again", onPress: () => void list.refetch() }}
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
  skeletons: { gap: Spacing.three, paddingVertical: Spacing.three },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  centered: { alignSelf: "center", marginTop: Spacing.five },
  footer: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
});
