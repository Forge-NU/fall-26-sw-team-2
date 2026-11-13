import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { StoryViewer } from '@/components/story/story-viewer';
import { Palette } from '@/constants/theme';
import { useCloseOnce } from '@/hooks/use-close-once';
import { useTripStories } from '@/hooks/use-stories';
import { storiesOnDay } from '@/lib/stories';

// Kept stories from one day of a trip, opened from the trip page (#25 STORY-3).
// Taps through that day's stories and closes after the last.
export default function TripStoriesScreen() {
  const { id, day, storyId } = useLocalSearchParams<{ id: string; day: string; storyId: string }>();
  const stories = useTripStories(id);
  const close = useCloseOnce();

  const dayStories = storiesOnDay(stories.data ?? [], day);
  // Every kept story on a trip is the trip owner's, so the day is one group
  const groups = dayStories.length > 0 ? [{ owner: dayStories[0].owner, stories: dayStories }] : [];
  const found = dayStories.some((story) => story.id === storyId);

  // Deleted somewhere else, or the list failed to load
  const nothingToShow = !stories.isPending && !found;
  useEffect(() => {
    if (nothingToShow) close();
  }, [nothingToShow, close]);

  if (!found) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Palette.white} />
      </View>
    );
  }
  return <StoryViewer groups={groups} initialStoryId={storyId} hideTripLink onClose={close} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.black,
  },
});
