import { Pressable, StyleSheet, View } from "react-native";
import type { PostResponse } from "shared-types";
import { AppText } from "@/components/ui/app-text";
import { CardLink } from "./card-link";
import { formatDate } from "@/utils/local-date";
import { UserRow } from "./user-row";
import { StatRow, type Stat } from "./stat-row";
import { MediaCarousel, type Photo } from "./media-carousel";
import { contentStyles } from "./content-styles";
import { ShareAction } from "./share-action";
import { ContentTokens } from "@/constants/content-tokens";

export type PostCardProps = {
  post: PostResponse;
  stats?: readonly Stat[];
  onPress?: () => void;
  onUserPress?: () => void;
  onShare?: () => void;
  /** Opens who liked the post; shown once it has likes */
  onLikesPress?: () => void;
};
export function PostCard({
  post,
  stats,
  onPress,
  onUserPress,
  onShare,
  onLikesPress,
}: PostCardProps) {
  const photos = post.media.filter(
    (item): item is Photo => item.mediaType === "image",
  );
  const location = post.location?.name ?? post.customLocationName;
  return (
    <View style={contentStyles.card}>
      <UserRow
        user={post.author}
        subtitle={location || formatDate(post.visitedOn)}
        subtitleIcon={location ? "map-pin" : undefined}
        onPress={onUserPress}
      />
      <MediaCarousel items={photos} />
      {(stats || onShare) && (
        <View style={contentStyles.cardHeader}>
          <View style={contentStyles.cardAuthor}>
            {stats && (
              <StatRow
                items={stats.map((stat) => ({
                  ...stat,
                  icon:
                    stat.icon ??
                    (stat.key === "likes"
                      ? "heart"
                      : stat.key === "comments"
                        ? "message-circle"
                        : stat.key === "saves"
                          ? "bookmark"
                          : undefined),
                }))}
              />
            )}
          </View>
          {onShare && <ShareAction label="Share post" onPress={onShare} />}
        </View>
      )}
      {onLikesPress && post.likeCount > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See who liked this post, ${likedBy(post.likeCount)}`}
          onPress={onLikesPress}
          style={styles.likedBy}
        >
          <AppText variant="label">{likedBy(post.likeCount)}</AppText>
        </Pressable>
      )}
      {post.caption && (
        <AppText numberOfLines={onPress ? 3 : undefined}>
          {post.caption}
        </AppText>
      )}
      <View style={contentStyles.footer}>
        <AppText variant="caption" color="placeholderGray">
          {formatDate(post.visitedOn)}
        </AppText>
        {onPress && <CardLink title="View post" onPress={onPress} />}
      </View>
    </View>
  );
}

const likedBy = (count: number) =>
  `Liked by ${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;

const styles = StyleSheet.create({
  likedBy: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: ContentTokens.actionSize,
  },
});
