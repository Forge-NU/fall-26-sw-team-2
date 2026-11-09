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
  media: MediaResponse[]; // carousel order
  createdAt: string;
  updatedAt: string;
};

// POST /api/posts. Exactly one of locationId and customLocationName.
export type CreatePostRequest = {
  tripId: string;
  visitedOn: string; // YYYY-MM-DD, within the trip's dates
  caption?: string | null; // up to 2,200 characters
  locationId?: string;
  customLocationName?: string; // 1-100 characters
  media: CreatePostMedia[]; // 1-30, carousel order
};

export type CreatePostMedia = {
  s3Key: string;
  mediaType: MediaType;
  width?: number;
  height?: number;
  durationMs?: number; // videos only (#53)
};
