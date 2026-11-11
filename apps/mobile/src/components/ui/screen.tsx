import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { getErrorMessage } from '@/api/client';
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { MaxContentWidth, Spacing, Theme } from '@/constants/theme';

export type ScreenProps = {
  children?: ReactNode;
  // Stays put above the content, even when it scrolls. Usually a ScreenHeader.
  header?: ReactNode;
  // Wrap the content in a ScrollView. Leave off for screens with their own FlatList.
  scroll?: boolean;
  edges?: Edge[];
  // Shows `loadingFallback`, or a few skeleton rows
  loading?: boolean;
  loadingFallback?: ReactNode;
  // Anything but null/undefined shows the error state, with Try again if `onRetry` is set.
  // Pass null once there's data (`error={query.data ? null : query.error}`), so a failed
  // refresh doesn't hide what already loaded.
  error?: unknown;
  onRetry?: () => void;
  // Replaces parts of the default error state, e.g. a different title
  errorState?: Partial<EmptyStateProps>;
  // Shown instead of the content when set, e.g. `empty={trips.length === 0 && { title: 'No trips yet' }}`
  empty?: EmptyStateProps | false | null;
};

// Standard page: safe area, warm background, 16px gutters, an optional header,
// and loading, error and empty states. In that order: loading wins over error,
// error over empty, and the children only show when none of them apply.
export function Screen({
  children,
  header,
  scroll = false,
  edges = ['top', 'bottom'],
  loading = false,
  loadingFallback,
  error,
  onRetry,
  errorState,
  empty,
}: ScreenProps) {
  let body: ReactNode;
  if (loading) {
    body = (
      <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={styles.loading}>
        {loadingFallback ?? <DefaultLoading />}
      </View>
    );
  } else if (error != null) {
    body = (
      <View style={styles.center}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this"
          description={getErrorMessage(error)}
          action={onRetry ? { title: 'Try again', onPress: onRetry } : undefined}
          {...errorState}
        />
      </View>
    );
  } else if (empty) {
    body = (
      <View style={styles.center}>
        <EmptyState {...empty} />
      </View>
    );
  } else if (scroll) {
    body = (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={styles.body}>{children}</View>;
  }

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View style={styles.content}>
        {header}
        {body}
      </View>
    </SafeAreaView>
  );
}

function DefaultLoading() {
  return (
    <>
      <Skeleton height={28} width="60%" />
      <Skeleton height={140} />
      <Skeleton height={44} />
      <Skeleton height={44} />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.three },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: Spacing.three, paddingBottom: Spacing.three },
  loading: { gap: Spacing.three },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
