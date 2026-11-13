import type { InfiniteData } from '@tanstack/react-query';
import type { CommentResponse, PaginatedResponse } from 'shared-types';

export const COMMENT_MAX_LENGTH = 500;

export const commentKeys = {
  /** A post's top-level comments */
  list: (postId: string) => ['posts', postId, 'comments'] as const,
  replies: (commentId: string) => ['comments', commentId, 'replies'] as const,
};

export type CommentPages = InfiniteData<PaginatedResponse<CommentResponse>>;

/** Characters the way Postgres's char_length counts them: by code point, so ❤️ is 2. */
export function commentLength(text: string): number {
  return Array.from(text.trim()).length;
}

/** The composer's Post button is off when there's nothing to send or it's over the limit. */
export function canSendComment(body: string): boolean {
  const length = commentLength(body);
  return length > 0 && length <= COMMENT_MAX_LENGTH;
}

/** What the composer starts with when replying: an @mention only for a reply to someone else's reply. */
export function replyPrefill(target: CommentResponse, myId: string | undefined): string {
  return target.parentCommentId && target.author.id !== myId ? `@${target.author.username} ` : '';
}

/**
 * The body to send. The API stores the mention as `replyTo` and the app shows
 * it in front of the text, so the prefilled @mention comes off the body.
 */
export function bodyToSend(text: string, target: CommentResponse | null, myId: string | undefined): string {
  const prefill = target ? replyPrefill(target, myId).trim() : '';
  const trimmed = text.trim();
  if (prefill && (trimmed === prefill || trimmed.startsWith(`${prefill} `))) {
    return trimmed.slice(prefill.length).trim();
  }
  return trimmed;
}

/** Adds a new comment after the last loaded one, since lists are oldest first. */
export function appendComment(data: CommentPages | undefined, comment: CommentResponse): CommentPages | undefined {
  if (!data) return data;
  const pages = [...data.pages];
  const last = pages.length - 1;
  pages[last] = { ...pages[last], items: [...pages[last].items, comment] };
  return { ...data, pages };
}

/** Takes a comment out of every loaded page. */
export function removeComment(data: CommentPages | undefined, commentId: string): CommentPages | undefined {
  if (!data?.pages.some((page) => page.items.some((item) => item.id === commentId))) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== commentId) })),
  };
}

/** Moves a top-level comment's replyCount by `delta`, never below zero. */
export function adjustReplyCount(
  data: CommentPages | undefined,
  commentId: string,
  delta: number,
): CommentPages | undefined {
  if (!data?.pages.some((page) => page.items.some((item) => item.id === commentId))) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === commentId ? { ...item, replyCount: Math.max(0, item.replyCount + delta) } : item,
      ),
    })),
  };
}

/** "now", "5m", "3h", "2d", "4w", then the date. Instagram-style. */
export function formatTimeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
  if (seconds < 52 * 7 * 86_400) return `${Math.floor(seconds / (7 * 86_400))}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
