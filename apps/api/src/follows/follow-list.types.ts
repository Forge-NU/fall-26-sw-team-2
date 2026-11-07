// Local response contracts until API-1 (#28) provides shared-types.
// Move these contracts into that package when it is available.
export interface FollowListUser {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

export interface FollowListPage {
  items: FollowListUser[];
  nextCursor: string | null;
}

export interface FollowStatus {
  isFollowing: boolean;
}

export interface FollowCounts {
  followerCount: number;
  followingCount: number;
}
