// Comments for INT-4 (#52), on INT-2's endpoints (#50, see
// docs/architecture/comments.md). The mocks are for EXPO_PUBLIC_API_MOCKS=all.
import type { CommentResponse, CreateCommentRequest, PaginatedResponse, UserResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockAdjustCommentCount } from '@/api/engagement';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { MOCK_ME } from '@/api/users';

const commentsPath = (postId: string) => `/api/posts/${encodeURIComponent(postId)}/comments`;
const commentPath = (id: string) => `/api/comments/${encodeURIComponent(id)}`;

/** A post's top-level comments, oldest first, each with its replyCount. */
export const listComments = withMock<
  [postId: string, cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<CommentResponse>
>({
  live: true,
  real: (postId, cursor, signal) => apiGet(commentsPath(postId), { cursor, limit: 20 }, { signal }),
  mock: async (postId, cursor) => {
    await mockDelay();
    const top = mockComments.filter((c) => c.postId === postId && !c.parentCommentId);
    return mockPage(top.map(withReplyCount), cursor);
  },
});

/** A top-level comment's replies, oldest first. */
export const listReplies = withMock<
  [commentId: string, cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<CommentResponse>
>({
  live: true,
  real: (commentId, cursor, signal) => apiGet(`${commentPath(commentId)}/replies`, { cursor, limit: 20 }, { signal }),
  mock: async (commentId, cursor) => {
    await mockDelay();
    mockFind(commentId);
    return mockPage(
      mockComments.filter((c) => c.parentCommentId === commentId).map((c) => ({ ...c })),
      cursor,
    );
  },
});

/** A reply to a reply comes back under the same top-level comment, with `replyTo` set. */
export const createComment = withMock<[postId: string, body: CreateCommentRequest], CommentResponse>({
  live: true,
  real: (postId, body) => apiRequest('POST', commentsPath(postId), body),
  mock: async (postId, { body, parentCommentId }) => {
    await mockDelay();
    const text = body.trim();
    if (!text || Array.from(text).length > 500) mockError(400, 'body must be 1 to 500 characters', commentsPath(postId));
    const parent = parentCommentId ? mockFind(parentCommentId) : null;
    const top = parent?.parentCommentId ? mockFind(parent.parentCommentId) : parent;
    const comment: CommentResponse = {
      id: `mock-comment-${Date.now().toString(36)}-${mockComments.length}`,
      postId,
      parentCommentId: top?.id ?? null,
      author: MOCK_ME,
      replyTo: parent?.parentCommentId && parent.author.id !== MOCK_ME.id ? parent.author : null,
      body: text,
      replyCount: 0,
      createdAt: new Date().toISOString(),
    };
    mockComments.push(comment);
    mockAdjustCommentCount(postId, 1);
    return { ...comment };
  },
});

/** Deletes your comment, and its replies if it's a top-level one. */
export const deleteComment = withMock<[id: string], void>({
  live: true,
  real: (id) => apiRequest('DELETE', commentPath(id)),
  mock: async (id) => {
    await mockDelay();
    const comment = mockFind(id);
    if (comment.author.id !== MOCK_ME.id) mockError(403, "You can only delete your own comments", commentPath(id));
    const removed = mockComments.filter((c) => c.id === id || c.parentCommentId === id);
    mockComments = mockComments.filter((c) => !removed.includes(c));
    mockAdjustCommentCount(comment.postId, -removed.length);
  },
});

// Mock data: the seed's thread on Maya's first Lisbon post (Priya comments,
// Maya replies, Alex replies to Maya), plus one more comment

const person = (id: string, firstName: string, lastName: string): UserResponse => ({
  id,
  firstName,
  lastName,
  username: `${firstName}.${lastName}`.toLowerCase(),
  avatarUrl: null,
});
const priya = person('mock-liker-1', 'Priya', 'Shah');
const maya = person('mock-maya', 'Maya', 'Chen');
const alex = person('mock-alex', 'Alex', 'Rivera');

const mockComment = (
  id: string,
  author: UserResponse,
  body: string,
  createdAt: string,
  parentCommentId: string | null = null,
  replyTo: UserResponse | null = null,
): CommentResponse => ({
  id,
  postId: 'mock-post-1',
  parentCommentId,
  author,
  replyTo,
  body,
  replyCount: 0,
  createdAt,
});

let mockComments: CommentResponse[] = [
  mockComment('mock-comment-1', priya, 'How long was the line?', '2026-09-12T19:00:00.000Z'),
  mockComment('mock-comment-2', maya, 'Maybe 10 minutes at opening!', '2026-09-12T19:20:00.000Z', 'mock-comment-1'),
  mockComment('mock-comment-3', alex, 'Same for us in August', '2026-09-12T20:05:00.000Z', 'mock-comment-1', maya),
  mockComment('mock-comment-4', alex, 'Adding this to my list.', '2026-09-13T08:30:00.000Z'),
];

function mockFind(id: string): CommentResponse {
  return mockComments.find((c) => c.id === id) ?? mockError(404, 'Comment not found', commentPath(id));
}

function withReplyCount(comment: CommentResponse): CommentResponse {
  return { ...comment, replyCount: mockComments.filter((c) => c.parentCommentId === comment.id).length };
}
