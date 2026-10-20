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
