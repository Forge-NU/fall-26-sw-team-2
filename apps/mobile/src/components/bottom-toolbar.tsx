import { type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Icon, IconName } from '@/components/icon';
import { Palette, Radii } from '@/constants/theme';

export type ToolbarDestination = 'feed' | 'saved' | 'post' | 'maps' | 'profile';

const Labels: Record<ToolbarDestination, string> = {
  feed: 'Feed',
  saved: 'Saved',
  post: 'Post',
  maps: 'Maps',
  profile: 'My Profile',
};

const Icons: Record<ToolbarDestination, IconName> = {
  feed: 'house',
  saved: 'bookmark',
  post: 'plus',
  maps: 'map',
  profile: 'user-round',
};

/** Bar container passed to `<TabList asChild>`. */
export function BottomToolbar({ children, style, ...props }: TabListProps) {
  const insets = useSafeAreaInsets();
  return (
    <View {...props} style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 8) }, style]}>
      {children}
    </View>
  );
}

type ToolbarItemProps = TabTriggerSlotProps & { destination: ToolbarDestination };

export function ToolbarItem({ destination, isFocused, style, ref, ...props }: ToolbarItemProps) {
  // Post is always emphasised in the wireframes; other labels go bold when focused.
  const emphasised = isFocused || destination === 'post';

  return (
    <Pressable
      {...props}
      // expo-router types this as a ref to View, which RN 0.88 types as a function component.
      // At runtime it's the Pressable's element.
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <DestinationIcon destination={destination} isFocused={!!isFocused} />
      <AppText
        variant="caption"
        color={emphasised ? 'black' : 'placeholderGray'}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={styles.label}>

        {Labels[destination]}
      </AppText>
    </Pressable>
  );
}

function DestinationIcon({
  destination,
  isFocused,
}: {
  destination: ToolbarDestination;
  isFocused: boolean;
}) {
  const isPost = destination === 'post';
  // Only Feed changes color in the wireframes; the rest stay black.
  const color = isPost ? 'warmWhite' : destination === 'feed' && isFocused ? 'teal' : 'black';

  return (
    <View style={[styles.tile, isPost && styles.postTile]}>
      <Icon name={Icons[destination]} size={22} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: Palette.warmWhite,
    borderTopWidth: 1,
    borderTopColor: Palette.lightPink,
  },
  item: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    // Keeps long labels inside their slot so neighbours never overlap.
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  tile: {
    width: 42,
    height: 34,
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.warmWhite,
  },
  postTile: {
    backgroundColor: Palette.coral,
  },
});
