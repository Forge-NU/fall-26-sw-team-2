import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CommentResponse } from 'shared-types';

import { ApiError, getErrorMessage } from '@/api/client';
import { createComment, deleteComment } from '@/api/comments';
import {
  adjustReplyCount,
  appendComment,
  commentKeys,
  removeComment,
  type CommentPages,
} from '@/lib/comment-cache';
import { adjustCommentCount } from '@/lib/engagement';
import { showToast } from '@/lib/toast';

const notFoundMessage = (error: unknown) =>
  error instanceof ApiError && error.status === 404
    ? error.message === 'Post not found'
      ? 'Post no longer available'
      : 'That comment was deleted'
    : null;

/**
 * Posts a comment, or a reply when `parent` is set. The new comment is added
 * to the end of its list once the API returns it, since lists are oldest first.
 */
export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { toast: false },
    mutationFn: ({ body, parent }: { body: string; parent: CommentResponse | null }) =>
      createComment(postId, { body, ...(parent && { parentCommentId: parent.id }) }),
    onSuccess: (comment) => {
      adjustCommentCount(postId, 1);
      const parentId = comment.parentCommentId;
      if (parentId) {
        queryClient.setQueryData<CommentPages>(commentKeys.replies(parentId), (data) => appendComment(data, comment));
        queryClient.setQueryData<CommentPages>(commentKeys.list(postId), (data) => adjustReplyCount(data, parentId, 1));
      } else {
        queryClient.setQueryData<CommentPages>(commentKeys.list(postId), (data) => appendComment(data, comment));
      }
    },
    onError: (error) => {
      const notFound = notFoundMessage(error);
      showToast({ message: notFound ?? getErrorMessage(error), variant: 'error' });
      // Reload the thread so a deleted parent drops out
      if (notFound) void queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
    },
  });
}

/**
 * Deletes your comment straight away, with its replies if it's a top-level
 * one, and puts it back if the request fails.
 */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { toast: false },
    mutationFn: (comment: CommentResponse) => deleteComment(comment.id),
    onMutate: async (comment) => {
      const parentId = comment.parentCommentId;
      const listKey = commentKeys.list(postId);
      const repliesKey = commentKeys.replies(parentId ?? comment.id);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey, exact: true }),
        queryClient.cancelQueries({ queryKey: repliesKey, exact: true }),
      ]);
      const snapshot = {
        list: queryClient.getQueryData<CommentPages>(listKey),
        replies: queryClient.getQueryData<CommentPages>(repliesKey),
      };
      const removed = 1 + (parentId ? 0 : comment.replyCount);

      if (parentId) {
        queryClient.setQueryData<CommentPages>(repliesKey, (data) => removeComment(data, comment.id));
        queryClient.setQueryData<CommentPages>(listKey, (data) => adjustReplyCount(data, parentId, -1));
      } else {
        queryClient.setQueryData<CommentPages>(listKey, (data) => removeComment(data, comment.id));
      }
      adjustCommentCount(postId, -removed);
      return { snapshot, removed, listKey, repliesKey };
    },
    onError: (error, _comment, context) => {
      // Already gone: leave it off the screen
      if (error instanceof ApiError && error.status === 404) return;
      if (context) {
        queryClient.setQueryData(context.listKey, context.snapshot.list);
        queryClient.setQueryData(context.repliesKey, context.snapshot.replies);
        adjustCommentCount(postId, context.removed);
      }
      showToast({ message: getErrorMessage(error), variant: 'error' });
    },
    onSuccess: (_data, comment) => {
      if (!comment.parentCommentId) queryClient.removeQueries({ queryKey: commentKeys.replies(comment.id) });
    },
  });
}
