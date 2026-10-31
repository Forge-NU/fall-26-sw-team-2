import { UserSummary } from '../common/user-summary';

// Response shapes for the comment endpoints (docs/architecture/comments.md).
// Mirrored in shared-types.

export type CommentResponse = {
  id: string;
  postId: string;
  // null for a top-level comment, else the top-level comment it's under
  parentCommentId: string | null;
  author: UserSummary;
  // The @mention on a reply to a reply, or null
  replyTo: UserSummary | null;
  body: string;
  // Replies under a top-level comment. Always 0 for a reply.
  replyCount: number;
  createdAt: string;
};
