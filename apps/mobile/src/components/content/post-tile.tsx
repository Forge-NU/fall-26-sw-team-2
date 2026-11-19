import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { PostResponse } from 'shared-types';

import { Media } from '@/components/ui/media';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';

export type PostTileProps = {
  post: PostResponse;
  /** Width and height. Tiles are square. */
  size: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** One square in a grid of posts: the post's first photo. */
export function PostTile({ post, size, onPress, style }: PostTileProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={postTileLabel(post)}
      onPress={onPress}
      disabled={!onPress}
      style={[{ width: size, height: size }, style]}>
      <Media
        seed={post.id}
        url={post.media.find((media) => media.mediaType === 'image')?.url}
        style={styles.media}
      />
    </Pressable>
  );
}

/** Loading placeholder for a grid of `PostTile`s, `columns` across. */
export function PostGridSkeleton({ size, columns = 2, rows = 3 }: { size: number; columns?: number; rows?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: columns * rows }, (_, i) => (
        <Skeleton key={i} width={size} height={size} />
      ))}
    </View>
  );
}

const LABEL_MAX = 80;

// Short enough for a screen reader to read out on every tile: the place, else
// the start of the caption (which can be up to 2200 characters)
function postTileLabel(post: PostResponse): string {
  const place = post.location?.name ?? post.customLocationName;
  if (place) return `Post at ${place}`;
  if (!post.caption) return 'Post';
  const chars = [...post.caption];
  return chars.length > LABEL_MAX ? `${chars.slice(0, LABEL_MAX).join('').trimEnd()}…` : post.caption;
}

const styles = StyleSheet.create({
  media: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.half },
});
