import { UserSummary } from '../common/user-summary';

// Response shapes for the trip endpoints (docs/architecture/itinerary-schema.md).
// Moves to shared-types with API-1 (#28).

export type TripStatus = 'draft' | 'published';

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
  createdAt: string;
  updatedAt: string;
};

export type ActiveTripsResponse = {
  items: TripResponse[];
};
