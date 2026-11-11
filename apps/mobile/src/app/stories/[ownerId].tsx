import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { StoryViewer } from '@/components/story/story-viewer';
import { Palette } from '@/constants/theme';
import { useCloseOnce } from '@/hooks/use-close-once';
import { useStoriesFeed } from '@/hooks/use-stories';

// The stories bar's viewer: opens on the tapped user's first story, then goes
// on through everyone after them in the bar (#25 STORY-3).
export default function StoriesScreen() {
  const { ownerId } = useLocalSearchParams<{ ownerId: string }>();
  // Usually already cached from the feed; fetched here after a reload on this screen
  const { groups, isPending, hasNextPage, isFetchNextPageError, loadMore, fetchNextPage } = useStoriesFeed();
  const close = useCloseOnce();

  // Picked once, so later cache updates don't move the viewer back to the start
  const [initialStoryId, setInitialStoryId] = useState<string | null>(null);
  const startId = initialStoryId ?? groups.find((g) => g.owner.id === ownerId)?.stories[0]?.id ?? null;
  if (startId && !initialStoryId) setInitialStoryId(startId);

  // After a reload the user can be on a later page, so keep loading until they turn up
  const searching = !isPending && !startId;
  const morePages = hasNextPage && !isFetchNextPageError;
  useEffect(() => {
    if (searching && morePages) loadMore();
  }, [searching, morePages, loadMore]);

  // Their stories expired, or the feed failed to load
  const nothingToShow = searching && !morePages;
  useEffect(() => {
    if (nothingToShow) close();
  }, [nothingToShow, close]);

  // The viewer reached the last loaded user
  const loadNextPage = useCallback(async () => !(await fetchNextPage()).isError, [fetchNextPage]);

  if (!startId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Palette.white} />
      </View>
    );
  }
  return (
    <StoryViewer
      groups={groups}
      initialStoryId={startId}
      hasMore={hasNextPage}
      loadMore={loadNextPage}
      onClose={close}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.black,
  },
});
