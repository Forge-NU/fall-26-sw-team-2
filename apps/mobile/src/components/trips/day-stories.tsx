import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import type { StoryResponse } from 'shared-types';

import { AppText } from '@/components/ui/app-text';
import { Media } from '@/components/ui/media';
import { Palette } from '@/constants/palette';
import { Radii, Spacing } from '@/constants/theme';
import { storyPlaceName } from '@/lib/stories';

/**
 * One day's kept stories on the trip page (#25 STORY-3), including ones that
 * have left the stories bar. Tapping one opens the viewer on that day's stories.
 */
export function DayStories({ tripId, day, stories }: { tripId: string; day: string; stories: StoryResponse[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {stories.map((story, i) => {
        const place = storyPlaceName(story);
        return (
          <Pressable
            key={story.id}
            accessibilityRole="button"
            accessibilityLabel={`Story ${i + 1} of ${stories.length}${place ? `, ${place}` : ''}`}
            onPress={() =>
              router.push({ pathname: '/trips/[id]/stories', params: { id: tripId, day, storyId: story.id } })
            }
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <Media seed={story.id} url={story.imageUrl} style={styles.photo} />
            {place ? (
              <AppText variant="caption" numberOfLines={1} style={styles.place}>
                {place}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const TILE_WIDTH = 84;

const styles = StyleSheet.create({
  row: { gap: Spacing.two },
  tile: { width: TILE_WIDTH, gap: Spacing.one },
  // Stories are portrait photos (9:16)
  photo: { width: TILE_WIDTH, aspectRatio: 9 / 16, borderRadius: Radii.medium },
  place: { color: Palette.placeholderGray },
  pressed: { opacity: 0.7 },
});
