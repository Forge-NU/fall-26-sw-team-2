import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { StoryGroup } from 'shared-types';

import { StoryUploadPills } from '@/components/story/story-upload-pill';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useStoriesFeed } from '@/hooks/use-stories';
import { useStoryUploads } from '@/hooks/use-story-uploads';
import { useCurrentUser } from '@/lib/current-user';
import { storyOwnerName } from '@/lib/stories';

/**
 * The stories bar at the top of the feed (#25 STORY-3): the user and the people
 * they follow with active stories. The user's own posting or failed stories
 * show first, as upload pills (#101).
 */
export function StoriesRow() {
  const user = useCurrentUser();
  const { groups, isPending, loadMore } = useStoriesFeed();
  const hasUploads = useStoryUploads().length > 0;

  return (
    <FlatList
      horizontal
      data={groups}
      keyExtractor={(group) => group.owner.id}
      renderItem={({ item }) => <StoryBubble group={item} isOwn={item.owner.id === user.id} />}
      ListHeaderComponent={
        <View style={[styles.row, hasUploads && groups.length > 0 && styles.rowSpaced]}>
          <StoryUploadPills />
          {isPending ? <LoadingBubbles /> : null}
        </View>
      }
      ItemSeparatorComponent={Separator}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    />
  );
}

function StoryBubble({ group, isOwn }: { group: StoryGroup; isOwn: boolean }) {
  const name = storyOwnerName(group.owner);
  const label = isOwn ? 'Your story' : group.owner.firstName || name;
  const count = group.stories.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isOwn ? 'Your' : `${name}'s`} story, ${count} ${count === 1 ? 'photo' : 'photos'}`}
      onPress={() => router.push({ pathname: '/stories/[ownerId]', params: { ownerId: group.owner.id } })}
      style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}>
      <Avatar name={name} uri={group.owner.avatarUrl} size="compact" />
      <AppText variant="caption" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

function LoadingBubbles() {
  return [0, 1, 2].map((key) => <Skeleton key={key} width={76} height={34} style={styles.loading} />);
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowSpaced: {
    marginRight: Spacing.two,
  },
  separator: {
    width: Spacing.two,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 140,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radii.circle,
    borderWidth: 1,
    borderColor: Palette.lightPink,
    backgroundColor: Palette.warmWhite,
  },
  pressed: {
    opacity: 0.7,
  },
  loading: {
    borderRadius: Radii.circle,
  },
});
