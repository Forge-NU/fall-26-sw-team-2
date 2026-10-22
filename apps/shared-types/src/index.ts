/**
 * User profile response shape
 * Used by GET /api/me and GET /api/users/:id
 */
export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  avatarUrl: string | null;
}

/**
 * Paginated response shape for list endpoints
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/** Result of GET /api/users/username-availability. */
export interface UsernameAvailabilityResponse {
  available: boolean;
}
