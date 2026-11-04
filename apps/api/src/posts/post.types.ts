import { UserSummary } from '../common/user-summary';
import { LocationRating } from '../locations/location.types';

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
  // null until a post in a published trip rates the place
  rating: LocationRating | null;
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
  // 1-5 stars for the place, or null. Always null with a custom location.
  rating: number | null;
  media: MediaResponse[];
  createdAt: string;
  updatedAt: string;
};
