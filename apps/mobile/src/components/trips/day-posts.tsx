import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import type { PostResponse } from 'shared-types';

import { AppText } from '@/components/ui/app-text';
import { Media } from '@/components/ui/media';
import { Palette } from '@/constants/palette';
import { Radii, Spacing, Typography } from '@/constants/theme';

export function postPlaceName(post: PostResponse): string {
  return post.location?.name ?? post.customLocationName ?? 'Unknown place';
}

// Back-to-back posts at the same place share one header, like the wireframe
function groupByPlace(posts: PostResponse[]) {
  const groups: { key: string; name: string; posts: PostResponse[] }[] = [];
  for (const post of posts) {
    const key = post.location?.id ?? `custom:${post.customLocationName}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.posts.push(post);
    else groups.push({ key, name: postPlaceName(post), posts: [post] });
  }
  return groups;
}

// One day's posts on the trip page (wireframe 02)
export function DayPosts({ posts }: { posts: PostResponse[] }) {
  return (
    <View style={styles.list}>
      {groupByPlace(posts).map((group, i) => (
        <View key={`${group.key}-${i}`} style={styles.group}>
          <View style={styles.place}>
            <Ionicons name="location-outline" size={14} color={Palette.placeholderGray} />
            <AppText variant="caption" style={styles.muted}>
              {group.name}
            </AppText>
          </View>
          {group.posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </View>
      ))}
    </View>
  );
}

// TODO(#43 POST-3): open post detail on press once that screen exists
function PostRow({ post }: { post: PostResponse }) {
  const cover = post.media[0];
  const count = post.media.length;

  return (
    <View style={styles.row} accessible accessibilityLabel={`${postPlaceName(post)}. ${post.caption ?? ''}`}>
      {/* A plain tile when there are no photos, so it doesn't read as a failed image */}
      {cover ? (
        <Media seed={post.id} url={cover.url} iconSize={Spacing.three} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]} />
      )}
      <AppText
        variant="label"
        numberOfLines={2}
        style={[styles.caption, !post.caption && styles.muted]}>
        {post.caption ?? 'No caption'}
      </AppText>
      <AppText variant="caption" style={styles.muted}>
        {count === 1 ? '1 photo' : `${count} photos`}
      </AppText>
    </View>
  );
}

const THUMB = 44;

const styles = StyleSheet.create({
  list: { gap: Spacing.three },
  group: { gap: Spacing.two },
  place: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radii.small },
  thumbEmpty: { backgroundColor: Palette.lightPink },
  caption: { flex: 1, fontFamily: Typography.body.fontFamily },
  muted: { color: Palette.placeholderGray },
});
