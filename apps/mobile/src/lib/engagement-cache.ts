import type { PostLikerResponse, PostResponse, TripResponse } from 'shared-types';

export type SaveTarget = 'post' | 'trip';

export const engagementKeys = {
  likes: (postId: string) => ['posts', postId, 'likes'] as const,
  /** Both saved lists, for invalidating them together */
  saved: ['me', 'saved'] as const,
  savedList: (target: SaveTarget) => ['me', 'saved', target === 'post' ? 'posts' : 'trips'] as const,
};

export const isLikesKey = (key: readonly unknown[]) => key[0] === 'posts' && key[2] === 'likes';

// Posts have likeCount and trips have postCount, so a post and a trip never match each other
const marker: Record<SaveTarget, keyof PostResponse | keyof TripResponse> = {
  post: 'likeCount',
  trip: 'postCount',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Applies `update` to every copy of one post or trip inside `data`, however
 * deep: a single response, a page of items, or every page of an infinite list.
 * Returns `data` itself when nothing matched, so unrelated queries keep their data.
 */
export function updateEverywhere<T>(data: T, target: SaveTarget, id: string, update: (item: never) => unknown): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const next = value.map(walk);
      return next.some((item, i) => item !== value[i]) ? next : value;
    }
    if (!isRecord(value)) return value;
    if (value.id === id && marker[target] in value) return update(value as never);
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = walk(child);
      if (next[key] !== child) changed = true;
    }
    return changed ? next : value;
  };
  return walk(data) as T;
}

/** Whether `data` holds the post or trip anywhere. */
export function containsTarget(data: unknown, target: SaveTarget, id: string): boolean {
  return updateEverywhere(data, target, id, () => ({})) !== data;
}

/** Sets the like, moving the count by one, unless the server's count is given. */
export function withLike(post: PostResponse, liked: boolean, likeCount?: number): PostResponse {
  if (likeCount === undefined && post.likedByMe === liked) return post;
  return {
    ...post,
    likedByMe: liked,
    likeCount: likeCount ?? Math.max(0, post.likeCount + (liked ? 1 : -1)),
  };
}

/** Same as withLike, for a save on a post or trip. */
export function withSave<T extends { savedByMe: boolean; saveCount: number }>(
  item: T,
  saved: boolean,
  saveCount?: number,
): T {
  if (saveCount === undefined && item.savedByMe === saved) return item;
  return {
    ...item,
    savedByMe: saved,
    saveCount: saveCount ?? Math.max(0, item.saveCount + (saved ? 1 : -1)),
  };
}

/** Marks `userId` as followed or not in a loaded likes list. */
export function withLikerFollowing<T>(data: T, userId: string, isFollowing: boolean): T {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const next = value.map(walk);
      return next.some((item, i) => item !== value[i]) ? next : value;
    }
    if (!isRecord(value)) return value;
    if (value.id === userId && 'likedAt' in value) {
      const liker = value as unknown as PostLikerResponse;
      return liker.isFollowing === isFollowing ? liker : { ...liker, isFollowing };
    }
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = walk(child);
      if (next[key] !== child) changed = true;
    }
    return changed ? next : value;
  };
  return walk(data) as T;
}

/**
 * Keeps the first of each id. Saving or unsaving while scrolling shifts the
 * server's pages, so the next page can repeat something already on screen.
 */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));
}
