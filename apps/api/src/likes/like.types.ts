import { UserSummary } from '../common/user-summary';

// Response shapes for the like endpoints (docs/architecture/likes-and-saves.md).
// Mirrored in shared-types.

// Returned by POST and DELETE /api/posts/:id/like
export type LikeStatusResponse = {
  liked: boolean;
  likeCount: number;
};

// One row of GET /api/posts/:id/likes
export type PostLikerResponse = UserSummary & {
  // Whether the viewer follows this user
  isFollowing: boolean;
  likedAt: string;
};
