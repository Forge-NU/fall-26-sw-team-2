import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PostResponse } from 'shared-types';

import { postStats } from '@/components/content/engagement-stats';
import { CardLink } from '@/components/content/card-link';
import { contentStyles } from '@/components/content/content-styles';
import { MediaCarousel, type Photo } from '@/components/content/media-carousel';
import { likedBy } from '@/components/content/post-card';
import { StatRow } from '@/components/content/stat-row';
import { UserRow } from '@/components/content/user-row';
import { Icon } from '@/components/icon';
import { formatStars, StarRating } from '@/components/rating/star-rating';
import { AppText } from '@/components/ui/app-text';
import { ContentTokens } from '@/constants/content-tokens';
import { Palette } from '@/constants/palette';
import { Spacing, Typography } from '@/constants/theme';
import { formatDate } from '@/utils/local-date';

export type PostDetailProps = {
  post: PostResponse;
  /** Focuses the comment composer below */
  onCommentPress: () => void;
  /** Opened from this post's trip page, so "View trip" goes back instead of stacking another */
  fromTrip?: boolean;
};

/** Everything about one post, above its comments on post detail (#43 POST-3). */
export function PostDetail({ post, onCommentPress, fromTrip = false }: PostDetailProps) {
  const photos = post.media.filter((item): item is Photo => item.mediaType === 'image');
  const placeName = post.location?.name ?? post.customLocationName;
  const placeRating = post.location?.rating;

  const openTrip = () =>
    // Pushes the trip page when there's nothing to go back to, e.g. a deep link
    fromTrip && router.canGoBack()
      ? router.back()
      : router.push({ pathname: '/trips/[id]', params: { id: post.tripId } });

  return (
    <View style={styles.post}>
      {/* Not tappable yet, same as the trip page: profiles live inside the Profile tab */}
      <UserRow user={post.author} subtitle={formatDate(post.visitedOn)} subtitleIcon="calendar" />

      <MediaCarousel items={photos} />

      <StatRow items={postStats(post, { onCommentsPress: onCommentPress })} />
      {post.likeCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See who liked this post, ${likedBy(post.likeCount)}`}
          onPress={() => router.push({ pathname: '/posts/[id]/likes', params: { id: post.id } })}
          style={styles.likedBy}>
          <AppText variant="label">{likedBy(post.likeCount)}</AppText>
        </Pressable>
      ) : null}

      {placeName ? (
        <View style={styles.place}>
          <Icon name="map-pin" size={Spacing.three} color="placeholderGray" />
          <AppText variant="label" style={styles.placeName}>
            {placeName}
          </AppText>
          {placeRating ? (
            <View
              accessible
              accessibilityLabel={`Rated ${formatStars(placeRating.average)} out of 5 from ${placeRating.count} ${placeRating.count === 1 ? 'post' : 'posts'}`}
              style={styles.average}>
              <StarRating value={placeRating.average} size={12} />
              <AppText variant="caption" color="placeholderGray">
                {formatStars(placeRating.average)} ({placeRating.count.toLocaleString()})
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {post.rating != null ? (
        <View style={styles.rating}>
          <AppText variant="caption" color="placeholderGray">
            {post.author.firstName ? `${post.author.firstName}'s rating` : 'Their rating'}
          </AppText>
          <StarRating value={post.rating} />
        </View>
      ) : null}

      {post.caption ? <AppText style={styles.caption}>{post.caption}</AppText> : null}

      <View style={contentStyles.footer}>
        <CardLink title="View trip" onPress={openTrip} />
      </View>

      <AppText variant="subheading" accessibilityRole="header" style={styles.commentsTitle}>
        Comments{post.commentCount > 0 ? ` · ${post.commentCount.toLocaleString()}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { gap: Spacing.three, paddingBottom: Spacing.two },
  likedBy: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: ContentTokens.actionSize },
  place: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.one },
  placeName: { flexShrink: 1 },
  average: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginLeft: Spacing.one },
  rating: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  caption: { fontFamily: Typography.body.fontFamily, color: Palette.black },
  commentsTitle: { marginTop: Spacing.two },
});
