import type { PaginatedResponse, UserSummary } from './index.js';

// Follow contracts (docs/architecture/follower-system.md).

/** One row of GET /api/users/:id/followers and /following */
export interface FollowListUser extends UserSummary {
  /** Whether the signed-in user follows this user */
  isFollowing: boolean;
}

export type FollowListPage = PaginatedResponse<FollowListUser>;

export interface FollowStatus {
  isFollowing: boolean;
}

export interface FollowCounts {
  followerCount: number;
  followingCount: number;
}
