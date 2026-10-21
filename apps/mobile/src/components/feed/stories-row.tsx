import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Palette, Radii, Spacing } from '@/constants/theme';
import type { StoryBubble } from '@/data/mock';

export function StoriesRow({ stories }: { stories: StoryBubble[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {stories.map((story) => (
        <Pressable
          key={story.id}
          accessibilityRole="button"
          accessibilityLabel={`${story.label} story`}
          style={styles.bubble}>
          <Avatar name={story.label} uri={story.avatarUrl} size="compact" />
          <AppText variant="caption">
            {story.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radii.circle,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
});
