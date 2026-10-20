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

export type { TripStatus, TripResponse, ActiveTripsResponse, MediaType, MediaResponse, LocationResponse, PostResponse } from './content';
