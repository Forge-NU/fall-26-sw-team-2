import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Palette, Radius, ScreenGutter } from '@/constants/theme';
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
          <Image source={story.avatar} style={styles.avatar} />
          <AppText variant="bold" size={11}>
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
    paddingHorizontal: ScreenGutter,
    paddingVertical: 6,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    backgroundColor: Palette.border,
  },
});
