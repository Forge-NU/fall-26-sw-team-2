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

export type MediaType = "image" | "video";

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
  createdAt: string;
  updatedAt: string;
};
