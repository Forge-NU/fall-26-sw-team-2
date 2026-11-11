import type { PostResponse, TripResponse } from "shared-types";
import { toggleLike, toggleSave } from "@/lib/engagement";
import type { Stat } from "./stat-row";

/** Like and save buttons with their counts, for PostCard and post detail. */
export function postStats(post: PostResponse): Stat[] {
  return [
    {
      key: "likes",
      label: "likes",
      icon: "heart",
      count: post.likeCount,
      selected: post.likedByMe,
      onPress: () => toggleLike(post),
    },
    {
      key: "saves",
      label: "saves",
      icon: "bookmark",
      count: post.saveCount,
      selected: post.savedByMe,
      onPress: () => toggleSave("post", post),
    },
  ];
}

/** The save button with its count, for TripCard and the trip page header. */
export function tripStats(trip: TripResponse): Stat[] {
  return [
    {
      key: "saves",
      label: "saves",
      icon: "bookmark",
      count: trip.saveCount,
      selected: trip.savedByMe,
      onPress: () => toggleSave("trip", trip),
    },
  ];
}
