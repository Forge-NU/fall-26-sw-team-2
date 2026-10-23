import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedResponse } from 'shared-types';

import type { FollowCounts, FollowList, FollowListUser } from '@/api/profiles';

export const profileKeys = {
  me: ['me'] as const,
  user: (id: string) => ['users', id] as const,
  profile: (id: string) => ['users', id, 'profile'] as const,
  followStatus: (id: string) => ['users', id, 'follow-status'] as const,
  followList: (id: string, list: FollowList) => ['users', id, list] as const,
  trips: (id: string) => ['users', id, 'trips'] as const,
  posts: (id: string) => ['users', id, 'posts'] as const,
};

/** Adds `delta` to one count, never going below zero. */
export function adjustCount<T extends FollowCounts>(profile: T | undefined, field: keyof FollowCounts, delta: number) {
  return profile && { ...profile, [field]: Math.max(0, profile[field] + delta) };
}

/** Marks `userId` as followed or not on every loaded page of a follow list. */
export function setFollowingInPages(
  data: InfiniteData<PaginatedResponse<FollowListUser>> | undefined,
  userId: string,
  isFollowing: boolean,
) {
  return (
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((user) => (user.id === userId ? { ...user, isFollowing } : user)),
      })),
    }
  );
}

/**
 * Keeps the first of each id. A follow or unfollow while scrolling shifts the
 * server's pages, so the next page can repeat someone already on screen.
 */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));
}
