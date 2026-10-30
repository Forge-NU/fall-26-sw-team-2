import { UserSummary } from '../common/user-summary';

// Response shapes for the post endpoints (docs/architecture/itinerary-schema.md).
// Moves to shared-types with API-1 (#28).

export type MediaType = 'image' | 'video';

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
  // Whether the viewer has liked or saved this post
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};
