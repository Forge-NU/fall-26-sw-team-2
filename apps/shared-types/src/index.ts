/**
 * User profile response shape
 * Used by GET /api/me and GET /api/users/:id
 */
export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
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

export type { TripStatus, TripResponse, ActiveTripsResponse, MediaType, MediaResponse, LocationResponse, PostResponse } from './content';

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
