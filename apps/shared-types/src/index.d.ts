export interface UserResponse {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    avatarUrl: string | null;
}
export interface PaginatedResponse<T> {
    items: T[];
    nextCursor: string | null;
}
/** Result of GET /api/users/username-availability. */
export interface UsernameAvailabilityResponse {
    available: boolean;
}
