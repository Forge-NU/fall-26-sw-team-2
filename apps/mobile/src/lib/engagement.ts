import type { Query } from '@tanstack/react-query';
import type { PostLikerResponse, PostResponse, TripResponse } from 'shared-types';

import { ApiError, getErrorMessage } from '@/api/client';
import { followUser, likePost, saveItem, unfollowUser, unlikePost, unsaveItem } from '@/api/engagement';
import {
  containsTarget,
  engagementKeys,
  isLikesKey,
  updateEverywhere,
  withLike,
  withLikerFollowing,
  withSave,
  type SaveTarget,
} from '@/lib/engagement-cache';
import { queryClient } from '@/lib/query-client';
import { showToast } from '@/lib/toast';
import { createToggleSync, type ToggleSync } from '@/lib/toggle-sync';

// Likes, saves and the likes list's follow buttons change everywhere the post,
// trip or person is on screen at once, and go back if the request fails. Taps
// are never blocked: see createToggleSync for how they reach the server.

const syncs = new Map<string, ToggleSync>();

function getSync(key: string, create: () => ToggleSync): ToggleSync {
  let sync = syncs.get(key);
  if (!sync) {
    sync = create();
    syncs.set(key, sync);
  }
  return sync;
}

/** Rewrites every cached query that holds the post or trip. */
function patch(target: SaveTarget, id: string, update: (item: never) => unknown) {
  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data;
    const next = updateEverywhere(data, target, id, update);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
}

/**
 * Shows the change now, and again once any refetch of those queries is
 * cancelled: a cancelled fetch puts back the data from before it started.
 */
function show(target: SaveTarget, id: string, update: (item: never) => unknown) {
  patch(target, id, update);
  const holds = (query: Query) => containsTarget(query.state.data, target, id);
  void queryClient.cancelQueries({ predicate: holds }).then(() => patch(target, id, update));
}

function fail(error: unknown, target: SaveTarget, id: string) {
  if (error instanceof ApiError && error.status === 404) {
    showToast({ message: `${target === 'post' ? 'Post' : 'Trip'} no longer available`, variant: 'error' });
    // Refetch whatever still shows it, so it drops out of lists
    void queryClient.invalidateQueries({ predicate: (query) => containsTarget(query.state.data, target, id) });
    return;
  }
  showToast({ message: getErrorMessage(error), variant: 'error' });
}

/** Likes or unlikes the post. Tapping again undoes it. */
export function toggleLike(post: Pick<PostResponse, 'id' | 'likedByMe'>) {
  const { id } = post;
  getSync(`like:${id}`, () =>
    createToggleSync({
      send: (liked) => (liked ? likePost(id) : unlikePost(id)),
      read: (result) => result.liked,
      show: (liked) => show('post', id, (item: PostResponse) => withLike(item, liked)),
      settle: (result) => {
        patch('post', id, (item: PostResponse) => withLike(item, result.liked, result.likeCount));
        // Refetched the next time the likes list opens
        void queryClient.invalidateQueries({ queryKey: engagementKeys.likes(id), refetchType: 'none' });
      },
      fail: (error, liked) => {
        patch('post', id, (item: PostResponse) => withLike(item, liked));
        fail(error, 'post', id);
      },
    }),
  ).toggle(post.likedByMe);
}

/** Saves or unsaves the post or trip. Tapping again undoes it. */
export function toggleSave(target: SaveTarget, item: Pick<PostResponse | TripResponse, 'id' | 'savedByMe'>) {
  const { id } = item;
  getSync(`save:${target}:${id}`, () =>
    createToggleSync({
      send: (saved) => (saved ? saveItem(target, id) : unsaveItem(target, id)),
      read: (result) => result.saved,
      show: (saved) => show(target, id, (cached: PostResponse) => withSave(cached, saved)),
      settle: (result) => {
        patch(target, id, (cached: PostResponse) => withSave(cached, result.saved, result.saveCount));
        // Marked stale rather than refetched, so something you unsave from the
        // Saved tab stays there to save again until you leave or refresh
        void queryClient.invalidateQueries({ queryKey: engagementKeys.savedList(target), refetchType: 'none' });
      },
      fail: (error, saved) => {
        patch(target, id, (cached: PostResponse) => withSave(cached, saved));
        fail(error, target, id);
      },
    }),
  ).toggle(item.savedByMe);
}

/** Moves the post's commentCount everywhere it's on screen, after a comment is added or deleted. */
export function adjustCommentCount(postId: string, delta: number) {
  patch('post', postId, (item: PostResponse) => ({ ...item, commentCount: Math.max(0, item.commentCount + delta) }));
}

function setFollowing(userId: string, isFollowing: boolean) {
  for (const query of queryClient.getQueryCache().findAll({ predicate: (q) => isLikesKey(q.queryKey) })) {
    const data = query.state.data;
    const next = withLikerFollowing(data, userId, isFollowing);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
}

/** Follows or unfollows someone from a likes list. */
export function toggleFollow(user: Pick<PostLikerResponse, 'id' | 'isFollowing'>) {
  const { id } = user;
  getSync(`follow:${id}`, () =>
    createToggleSync({
      send: async (follow) => {
        await (follow ? followUser(id) : unfollowUser(id));
        return follow;
      },
      read: (follow) => follow,
      show: (follow) => setFollowing(id, follow),
      settle: () => {
        // Profiles and follow lists (#84) read this user's follow state
        void queryClient.invalidateQueries({ queryKey: ['users', id] });
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      },
      fail: (error, follow) => {
        setFollowing(id, follow);
        showToast({ message: getErrorMessage(error), variant: 'error' });
      },
    }),
  ).toggle(user.isFollowing);
}
