import type { UserSummary } from "./index.js";
import type { LocationResponse } from "./locations.js";

// Trip and post contracts (docs/architecture/itinerary-schema.md).

export type TripStatus = "draft" | "published";

export type TripResponse = {
  id: string;
  owner: UserSummary;
  title: string;
  destination: string;
  description: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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

// GET /api/me/trips/active?date=YYYY-MM-DD
export type ActiveTripsResponse = {
  items: TripResponse[];
};

// POST /api/trips
export type CreateTripRequest = {
  title: string; // 1-100 characters
  destination: string; // 1-100 characters
  description?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

// PATCH /api/trips/:id. Only description can be cleared with null.
export type UpdateTripRequest = Partial<Omit<CreateTripRequest, "description">> & {
  description?: string | null;
};

export type MediaType = "image" | "video";

export type MediaResponse = {
  id: string;
  mediaType: MediaType;
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

// Exactly one of location and customLocationName is set
export type PostResponse = {
  id: string;
  tripId: string;
  author: UserSummary;
  caption: string | null;
  visitedOn: string; // YYYY-MM-DD
  location: LocationResponse | null;
  customLocationName: string | null;
  rating: number | null; // 1-5 stars for the place; always null with a custom location
  media: MediaResponse[]; // carousel order
  likeCount: number;
  saveCount: number;
  /** Whether the viewer has liked this post */
  likedByMe: boolean;
  /** Whether the viewer has saved this post */
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

// POST /api/posts. Exactly one of locationId and customLocationName, and a
// rating only with a locationId.
export type CreatePostRequest = {
  tripId: string;
  visitedOn: string; // YYYY-MM-DD, within the trip's dates
  caption?: string | null; // up to 2,200 characters
  locationId?: string;
  customLocationName?: string; // 1-100 characters
  rating?: number | null; // 1-5 stars for the place
  media: CreatePostMedia[]; // 1-30, carousel order
};

export type CreatePostMedia = {
  s3Key: string;
  mediaType: MediaType;
  width?: number;
  height?: number;
  durationMs?: number; // videos only (#53)
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
