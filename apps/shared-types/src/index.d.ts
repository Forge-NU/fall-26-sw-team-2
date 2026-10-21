export interface UserResponse {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl: string | null;
}
export interface PaginatedResponse<T> {
    items: T[];
    nextCursor: string | null;
}
