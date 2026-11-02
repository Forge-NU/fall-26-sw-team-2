import { useState } from "react";
import { Asset } from "expo-asset";
import { Share, View } from "react-native";
import type { PostResponse, TripResponse, UserResponse } from "shared-types";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast-provider";
import { UserRow } from "./user-row";
import { StatRow } from "./stat-row";
import { TripCard } from "./trip-card";
import { PostCard } from "./post-card";
import { MediaCarousel, type Photo } from "./media-carousel";
import { contentStyles } from "./content-styles";

const maya: UserResponse = {
  id: "user_seed_maya",
  username: "mayachen",
  firstName: "Maya",
  lastName: "Chen",
  avatarUrl: null,
};
const previewAssets = [
  Asset.fromModule(require("@/assets/preview/belem-tower.jpg")),
  Asset.fromModule(require("@/assets/preview/lisbon-tram.jpg")),
  Asset.fromModule(require("@/assets/preview/pasteis-de-nata.jpg")),
  Asset.fromModule(require("@/assets/preview/sintra-palace.jpg")),
  Asset.fromModule(require("@/assets/preview/lisbon-panorama.jpg")),
];
const photos: Photo[] = Array.from({ length: 30 }, (_, i) => {
  const asset = previewAssets[i % previewAssets.length];
  return {
    id: `lisbon-${i}`,
    mediaType: "image",
    url: asset.localUri ?? asset.uri,
    width: asset.width,
    height: asset.height,
    durationMs: null,
  };
});
const trip: TripResponse = {
  id: "preview-lisbon",
  owner: maya,
  title: "5 Days in Lisbon",
  destination: "Lisbon, Portugal",
  description: "Sunset viewpoints, custard tarts and a day trip to Sintra.",
  startDate: "2026-09-12",
  endDate: "2026-09-16",
  status: "published",
  publishedAt: "2026-09-18T15:00:00Z",
  postCount: 6,
  coverImageUrl: photos[0].url,
  saveCount: 3,
  savedByMe: false,
  createdAt: "2026-09-10T12:00:00Z",
  updatedAt: "2026-09-18T15:00:00Z",
};
const post: PostResponse = {
  id: "preview-belem",
  tripId: trip.id,
  author: maya,
  caption: "Got here right at opening. Worth the early start!",
  visitedOn: "2026-09-12",
  location: null,
  customLocationName: "Belém Tower, Lisbon",
  media: photos.slice(0, 3),
  likeCount: 12,
  saveCount: 2,
  likedByMe: false,
  savedByMe: false,
  createdAt: "2026-09-12T18:00:00Z",
  updatedAt: "2026-09-12T18:00:00Z",
};

export function ContentPreview() {
  const [following, setFollowing] = useState(false);
  const [many, setMany] = useState(true);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const { showToast } = useToast();
  const notify = (message: string) => () => showToast({ message });
  const share = async (message: string) => {
    try {
      await Share.share({ message });
    } catch {
      showToast({
        message:
          "Sharing is unavailable. Try opening the preview on your phone.",
      });
    }
  };
  return (
    <View style={contentStyles.preview}>
      <AppText variant="heading">Content components</AppText>
      <AppText variant="supporting">IconButton</AppText>
      <View style={contentStyles.cardHeader}>
        <IconButton
          icon="heart"
          selectedIcon="heart-filled"
          selected={liked}
          count={Number(liked)}
          accessibilityLabel={liked ? "Unlike example" : "Like example"}
          onPress={() => setLiked((value) => !value)}
        />
        <IconButton
          icon="message-circle"
          accessibilityLabel="Comment example"
          onPress={notify("Comment selected.")}
        />
        <IconButton
          icon="chevron-right"
          color="teal"
          variant="surface"
          accessibilityLabel="Next example"
          onPress={notify("Next selected.")}
        />
        <IconButton
          icon="chevron-left"
          disabled
          accessibilityLabel="Previous example (disabled)"
        />
      </View>
      <View style={contentStyles.cardHeader}>
        <IconButton
          icon="bookmark"
          selectedIcon="bookmark-filled"
          selected={saved}
          accessibilityLabel={saved ? "Unsave example" : "Save example"}
          onPress={() => setSaved((value) => !value)}
        />
        <IconButton
          icon="send"
          accessibilityLabel="Share example"
          onPress={() => {
            void share("Explore Lisbon with YUJI");
          }}
        />
        <IconButton
          icon="x"
          accessibilityLabel="Close example"
          onPress={notify("Close selected.")}
        />
        <IconButton
          icon="ellipsis"
          accessibilityLabel="More options example"
          onPress={notify("More options selected.")}
        />
      </View>
      <AppText variant="supporting">UserRow</AppText>
      <UserRow
        user={maya}
        onPress={notify("Maya profile selected.")}
        action={{
          title: following ? "Following" : "Follow",
          variant: "teal",
          onPress: () => setFollowing((value) => !value),
        }}
      />
      <UserRow
        user={{
          ...maya,
          firstName: "Alexandra",
          lastName: "Rivera-Chen",
          username: "alexandra_travels_the_world",
        }}
      />
      <AppText variant="supporting">StatRow</AppText>
      <StatRow
        items={[
          {
            key: "followers",
            label: "followers",
            count: 248,
            onPress: notify("Followers selected."),
          },
          {
            key: "following",
            label: "following",
            count: 84,
            onPress: notify("Following selected."),
          },
        ]}
      />
      <AppText variant="supporting">TripCard</AppText>
      <TripCard
        trip={trip}
        onShare={() => {
          void share(trip.title);
        }}
        posts={[
          post,
          {
            ...post,
            id: "preview-tram",
            visitedOn: "2026-09-13",
            customLocationName: "Lisbon, Portugal",
            caption: "Exploring the city by tram.",
            media: photos.slice(1, 2),
          },
          {
            ...post,
            id: "preview-food",
            visitedOn: "2026-09-14",
            customLocationName: "Lisbon, Portugal",
            caption: "An afternoon stop for custard tarts.",
            media: photos.slice(2, 3),
          },
          {
            ...post,
            id: "preview-sintra",
            visitedOn: "2026-09-15",
            customLocationName: "Pena Palace, Sintra",
            caption: "A day trip to explore the colorful Pena Palace.",
            media: photos.slice(3, 4),
          },
          {
            ...post,
            id: "preview-last-day",
            visitedOn: "2026-09-16",
            customLocationName: "Lisbon, Portugal",
            caption: "One last panoramic view of Lisbon before heading home.",
            media: photos.slice(4, 5),
          },
          {
            ...post,
            id: "preview-last-treat",
            visitedOn: "2026-09-16",
            customLocationName: "Lisbon, Portugal",
            caption: "Taking a few custard tarts for the journey.",
            media: photos.slice(2, 3),
          },
        ]}
        onDayPress={(date) => showToast({ message: `Selected ${date}` })}
        onPress={notify("Lisbon itinerary selected.")}
      />
      <TripCard
        trip={{
          ...trip,
          id: "preview-draft",
          status: "draft",
          publishedAt: null,
          coverImageUrl: null,
          title: "Porto long weekend",
          destination: "Porto, Portugal",
          description: null,
          postCount: 0,
        }}
      />
      <AppText variant="supporting">PostCard</AppText>
      <PostCard
        post={post}
        onShare={() => {
          void share(`${post.customLocationName}: ${post.caption}`);
        }}
        onPress={notify("Belém post selected.")}
        stats={[
          {
            key: "likes",
            label: "likes",
            selected: liked,
            count: 248 + Number(liked),
            onPress: () => setLiked((value) => !value),
          },
          {
            key: "comments",
            label: "comments",
            count: 31,
            onPress: notify("Comments selected."),
          },
        ]}
      />
      <AppText variant="supporting">Carousel · 1 photo</AppText>
      <MediaCarousel items={photos.slice(0, 1)} />
      <AppText variant="supporting">
        Carousel · {many ? "30 photos" : "1 photo"}
      </AppText>
      <Button
        title={many ? "Switch to 1 photo" : "Switch to 30 photos"}
        variant="teal"
        onPress={() => setMany((value) => !value)}
      />
      <MediaCarousel items={many ? photos : photos.slice(0, 1)} />
      <AppText variant="supporting">Empty and unavailable media</AppText>
      <MediaCarousel items={[]} />
      <MediaCarousel items={[{ ...photos[0], url: "" }]} />
    </View>
  );
}
