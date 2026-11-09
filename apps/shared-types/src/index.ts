/**
 * The user fields shown next to content (trip owner, post author) and in user lists
 * Used by GET /api/users
 */
export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  avatarUrl: string | null;
}

/** Body of PATCH /api/me. avatarKey is an s3Key from an "avatar" upload, or null to remove it. */
export interface UpdateMeRequest {
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarKey?: string | null;
}

export interface UsernameAvailabilityResponse {
  available: boolean;
}

/**
 * User profile response shape
 * Used by GET /api/me, GET /api/users/:id, POST /api/me/profile and PATCH /api/me
 */
export interface UserResponse extends UserSummary {
  followerCount: number;
  followingCount: number;
}

/**
 * Paginated response shape for list endpoints
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Body of every error response, from the API's HttpExceptionFilter
 */
export interface ApiErrorResponse {
  statusCode: number;
  /** Validation errors are joined with "; " */
  message: string;
  /** e.g. "Not Found" */
  error: string;
  path: string;
  timestamp: string;
}

export type { TripStatus, TripResponse, ActiveTripsResponse, CreateTripRequest, UpdateTripRequest, MediaType, MediaResponse, PostResponse, CreatePostRequest, CreatePostMedia } from './content.js';
export type { LocationRating, LocationResponse, PlaceSuggestion, ResolveLocationRequest, ResolveLocationResponse } from './locations.js';
export type { StoryResponse, StoryGroup, StoriesFeedResponse, TripStoriesResponse, CreateStoryRequest } from './stories.js';
export type { FollowListUser, FollowListPage, FollowStatus, FollowCounts } from './follows.js';

/**
 * Photo uploads (MEDIA-1)
 * Used by POST /api/media/uploads
 */
export type UploadPurpose = 'post' | 'story' | 'avatar';

export type UploadContentType = 'image/jpeg';

export interface CreateUploadRequest {
  purpose: UploadPurpose;
  contentType: UploadContentType;
  /** Size in bytes, at most 10 MB */
  fileSize: number;
}

export interface CreateUploadResponse {
  /** e.g. users/{userId}/posts/{uuid}.jpg. Send this to the post, story or profile endpoint. */
  s3Key: string;
  /** Presigned S3 PUT URL. Send Content-Type and Content-Length matching the request. */
  uploadUrl: string;
  /** ISO timestamp, 15 minutes after the request */
  expiresAt: string;
}
