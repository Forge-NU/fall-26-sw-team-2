// STAND-IN: API-1 (#28) adds a shared-types package for these. Import from
// there and delete this file once it lands.
//
// Request and response shapes for the endpoints the app calls. Copied from:
// - #61 STORY-1: apps/api/src/stories/story.types.ts, dto/create-story.dto.ts
// - #56 trips: apps/api/src/trips/trip.types.ts, dto/create-trip.dto.ts
// - common/user-summary.ts, common/pagination.ts
// If those PRs change, update these to match.

export type UserSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// Trips (#56)

export type TripStatus = 'draft' | 'published';

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

// Stories (#61)

export type StoryLocationResponse = {
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

export type StoryResponse = {
  id: string;
  owner: UserSummary;
  tripId: string | null;
  text: string | null;
  location: StoryLocationResponse | null;
  customLocationName: string | null;
  imageUrl: string;
  keepOnTrip: boolean;
  expiresAt: string;
  createdAt: string;
};

// POST /api/stories. At most one of locationId and customLocationName, and
// keepOnTrip only with a tripId.
export type CreateStoryRequest = {
  s3Key: string;
  tripId?: string;
  keepOnTrip?: boolean;
  text?: string | null; // up to 200 characters
  locationId?: string;
  customLocationName?: string; // 1-100 characters
  date?: string; // the user's local today, YYYY-MM-DD, for the active-trip check
};

// Uploads (#38 MEDIA-1)
// GUESS: MEDIA-1 hasn't defined its contract yet. Replace with the real one
// when it lands. Keys for stories start with users/{userId}/stories/.

export type UploadPurpose = 'story';

export type CreateUploadRequest = {
  purpose: UploadPurpose;
  contentType: 'image/jpeg';
};

export type CreateUploadResponse = {
  uploadUrl: string; // presigned S3 PUT URL
  s3Key: string;
};
