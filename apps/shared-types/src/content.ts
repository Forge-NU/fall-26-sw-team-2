import type { UserResponse } from "./index";

// Content contracts match the current trip and post API responses.
type UserSummary = UserResponse;

export type TripStatus = "draft" | "published";

export type TripResponse = {
  id: string;
  owner: UserSummary;
  title: string;
  destination: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: TripStatus;
  publishedAt: string | null;
  postCount: number;
  coverImageUrl: string | null;
  saveCount: number;
  /** Whether the viewer has saved this trip */
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActiveTripsResponse = {
  items: TripResponse[];
};

export type MediaType = "image" | "video";

export type LocationResponse = {
  id: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

export type MediaResponse = {
  id: string;
  mediaType: MediaType;
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type PostResponse = {
  id: string;
  tripId: string;
  author: UserSummary;
  caption: string | null;
  visitedOn: string;
  location: LocationResponse | null;
  customLocationName: string | null;
  media: MediaResponse[];
  likeCount: number;
  saveCount: number;
  /** Every comment on the post, replies included */
  commentCount: number;
  /** Whether the viewer has liked this post */
  likedByMe: boolean;
  /** Whether the viewer has saved this post */
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

// Likes and saves (#49 INT-1). See docs/architecture/likes-and-saves.md.

/** Returned by POST and DELETE /api/posts/:id/like */
export type LikeStatusResponse = {
  liked: boolean;
  likeCount: number;
};

/** One row of GET /api/posts/:id/likes, newest like first */
export type PostLikerResponse = UserSummary & {
  /** Whether the viewer follows this user */
  isFollowing: boolean;
  likedAt: string;
};

/** Returned by POST and DELETE /api/trips/:id/save and /api/posts/:id/save */
export type SaveStatusResponse = {
  saved: boolean;
  saveCount: number;
};

// Comments (#50 INT-2). See docs/architecture/comments.md.

/** A comment or reply. Used by POST /api/posts/:id/comments and the comment lists. */
export type CommentResponse = {
  id: string;
  postId: string;
  /** null for a top-level comment, else the top-level comment it's under */
  parentCommentId: string | null;
  author: UserSummary;
  /** The @mention on a reply to a reply, or null */
  replyTo: UserSummary | null;
  /** 1 to 500 characters */
  body: string;
  /** Replies under a top-level comment. Always 0 for a reply. */
  replyCount: number;
  createdAt: string;
};

/** Body of POST /api/posts/:id/comments */
export type CreateCommentRequest = {
  /** 1 to 500 characters, after trimming */
  body: string;
  /** The comment being replied to. A reply to a reply goes under the same top-level comment. */
  parentCommentId?: string;
};
