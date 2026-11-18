import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoryGroup } from 'shared-types';

import { Icon } from '@/components/icon';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StoryTokens } from '@/constants/story-tokens';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { useDeleteStory } from '@/hooks/use-stories';
import { useCurrentUser } from '@/lib/current-user';
import { flattenGroups, stepStory, storyAfterLeaving, storyAge, storyOwnerName, storyPlaceName } from '@/lib/stories';

/** How long each story shows before moving on */
export const STORY_DURATION_MS = 5000;

type StoryViewerProps = {
  groups: StoryGroup[];
  /** The story to open on */
  initialStoryId: string;
  /** Hides the trip link, for the viewer opened from that trip's page */
  hideTripLink?: boolean;
  /** More users to load after the last group (the feed pages through users) */
  hasMore?: boolean;
  /** Loads the next page. Resolves false if it failed. */
  loadMore?: () => Promise<boolean>;
  onClose: () => void;
};

/**
 * Full-screen story viewer (#25 STORY-3). Taps through one user's stories, then
 * the next user's, and closes after the last. Tap the left third to go back,
 * hold to pause, swipe down to close.
 */
export function StoryViewer({
  groups,
  initialStoryId,
  hideTripLink = false,
  hasMore = false,
  loadMore,
  onClose,
}: StoryViewerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const user = useCurrentUser();
  const deleteStory = useDeleteStory();

  const stories = flattenGroups(groups);
  const [storyId, setStoryId] = useState(initialStoryId);
  const story = stories.find((s) => s.id === storyId);
  const group = story && groups.find((g) => g.owner.id === story.owner.id);

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Past the last loaded story: 'loading' the next page of users, then 'loaded'
  const [atEnd, setAtEnd] = useState<'no' | 'loading' | 'loaded'>('no');
  const paused = held || confirmingDelete || atEnd !== 'no' || loadedId !== storyId;

  const nextId = stepStory(stories, storyId, 1)?.id ?? null;

  const step = (direction: 1 | -1) => {
    const next = stepStory(stories, storyId, direction);
    if (next) setStoryId(next.id);
    else if (direction === -1 || atEnd !== 'no') return;
    else if (hasMore && loadMore) {
      setAtEnd('loading');
      void loadMore().then((loaded) => (loaded ? setAtEnd('loaded') : onClose()));
    } else onClose();
  };

  // The next page brought more stories: go on into them
  if (atEnd !== 'no' && nextId) {
    setAtEnd('no');
    setStoryId(nextId);
  }

  // The list the open story was last in, to know where to go if it leaves.
  // Compared by ids, since the list is rebuilt on every render.
  const storiesKey = stories.map((s) => s.id).join('|');
  const [lastSeen, setLastSeen] = useState({ key: storiesKey, stories });
  if (story && lastSeen.key !== storiesKey) setLastSeen({ key: storiesKey, stories });

  // The open story was deleted here, or expired while open: go on to the next one
  const fallbackId = story ? null : storyAfterLeaving(lastSeen.stories, stories, storyId, deletingId === storyId)?.id;
  if (fallbackId) setStoryId(fallbackId);

  // Nothing left to show: the last story left, or the next page had nothing new
  const shouldClose = (!story && !fallbackId) || (atEnd === 'loaded' && !nextId);
  useEffect(() => {
    if (shouldClose) onClose();
  }, [shouldClose, onClose]);

  // Loads the next photo while this one shows
  const nextUrl = stepStory(stories, storyId, 1)?.imageUrl;
  useEffect(() => {
    if (nextUrl) void Image.prefetch(nextUrl);
  }, [nextUrl]);

  const progress = useProgress(storyId, paused, () => step(1));

  const swipeDown = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80) onClose();
        },
      }),
    [onClose],
  );

  if (!story || !group) return null;

  const isOwn = story.owner.id === user.id;
  const groupIndex = group.stories.findIndex((s) => s.id === storyId);
  const name = storyOwnerName(story.owner);
  const place = storyPlaceName(story);
  const trip = hideTripLink ? null : story.trip;

  function confirmDelete() {
    if (!story) return;
    setDeletingId(story.id);
    deleteStory.mutate(story, {
      // The cache update removes the story, and the viewer moves on to the next.
      // A failed delete toasts (queryClient's mutation cache).
      onError: () => setDeletingId(null),
      onSettled: () => setConfirmingDelete(false),
    });
  }

  function openTrip(tripId: string) {
    onClose();
    router.push({ pathname: '/trips/[id]', params: { id: tripId } });
  }

  return (
    <View style={styles.screen} {...swipeDown.panHandlers}>
      {/* Keyed so a late load event from the previous photo can't mark this one loaded */}
      <Image
        key={story.id}
        source={{ uri: story.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessibilityLabel={story.text ?? `Story from ${name}`}
        onLoad={() => setLoadedId(story.id)}
        // A broken photo still moves on, instead of stalling the viewer
        onError={() => setLoadedId(story.id)}
      />

      {/* Left third goes back, the rest goes forward; holding pauses */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next story"
        accessibilityHint="Tap the left side for the previous story. Hold to pause."
        style={StyleSheet.absoluteFill}
        delayLongPress={250}
        // Having a long-press handler stops the release after a hold from counting as a tap
        onLongPress={() => {}}
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        onPress={(event) => step(event.nativeEvent.locationX < width / 3 ? -1 : 1)}
      />

      <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.bar}>
              <Animated.View
                style={[
                  styles.barFill,
                  i < groupIndex && styles.barDone,
                  i === groupIndex && {
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header} pointerEvents="box-none">
          <Avatar name={name} uri={story.owner.avatarUrl} size="small" />
          <View style={styles.flex}>
            <AppText variant="label" color="white" numberOfLines={1}>
              {isOwn ? 'Your story' : name}
            </AppText>
            <AppText variant="caption" color="white" style={styles.dim}>
              {storyAge(story.createdAt)}
            </AppText>
          </View>
          {isOwn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete story"
              hitSlop={Spacing.two}
              onPress={() => setConfirmingDelete(true)}
              style={styles.iconButton}>
              <Icon name="ellipsis" size={22} color="white" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close stories"
            hitSlop={Spacing.two}
            onPress={onClose}
            style={styles.iconButton}>
            <Icon name="x" size={24} color="white" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.three }]} pointerEvents="box-none">
        {story.text ? (
          <AppText variant="body" color="white" style={styles.text}>
            {story.text}
          </AppText>
        ) : null}
        <View style={styles.chips} pointerEvents="box-none">
          {place ? (
            <View style={styles.chip} accessibilityLabel={`Place: ${place}`}>
              <Icon name="map-pin" size={14} color="white" />
              <AppText variant="caption" color="white" numberOfLines={1} style={styles.chipText}>
                {place}
              </AppText>
            </View>
          ) : null}
          {trip ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open trip ${trip.title}`}
              onPress={() => openTrip(trip.id)}
              style={({ pressed }) => [styles.chip, styles.tripChip, pressed && styles.pressed]}>
              <Icon name="route" size={14} color="black" />
              <AppText variant="caption" numberOfLines={1} style={styles.chipText}>
                {trip.title}
              </AppText>
              <Icon name="chevron-right" size={14} color="black" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete story?"
        message={deleteMessage(story)}
        confirmLabel="Delete"
        loading={deleteStory.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </View>
  );
}

function deleteMessage(story: StoryGroup['stories'][number]): string {
  const inBar = new Date(story.expiresAt).getTime() > Date.now();
  if (story.keepOnTrip && inBar) return "It'll be removed from the stories bar and from your trip page.";
  if (story.keepOnTrip) return "It'll be removed from your trip page.";
  return "It'll be removed from the stories bar.";
}

/**
 * The current story's progress, 0 to 1. Restarts for each story, holds while
 * paused, and calls `onDone` when it fills.
 */
function useProgress(storyId: string, paused: boolean, onDone: () => void): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));
  const value = useRef(0);
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const id = progress.addListener(({ value: v }) => {
      value.current = v;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // Back to the start for each story. Declared before the timer, so it runs first.
  useEffect(() => {
    progress.setValue(0);
    value.current = 0;
  }, [storyId, progress]);

  useEffect(() => {
    if (paused) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS * (1 - value.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) done();
    });
    return () => animation.stop();
  }, [storyId, paused, progress]);

  return progress;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.black,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
    backgroundColor: StoryTokens.viewer.headerScrim,
  },
  bars: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: Radii.circle,
    overflow: 'hidden',
    backgroundColor: StoryTokens.viewer.progressTrack,
  },
  barFill: {
    width: '0%',
    height: '100%',
    backgroundColor: Palette.white,
  },
  barDone: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  dim: {
    opacity: 0.8,
  },
  iconButton: {
    padding: Spacing.one,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    backgroundColor: StoryTokens.viewer.captionScrim,
  },
  text: {
    textShadowColor: StoryTokens.viewer.textShadow,
    textShadowRadius: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: '100%',
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radii.circle,
    backgroundColor: StoryTokens.viewer.chip,
  },
  tripChip: {
    backgroundColor: Palette.warmWhite,
  },
  chipText: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
