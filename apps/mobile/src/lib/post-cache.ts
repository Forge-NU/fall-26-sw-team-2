import type { PostResponse } from 'shared-types';

import { queryKeys } from '@/api/query-keys';
import { removeEverywhere, updateEverywhere } from '@/lib/engagement-cache';
import { queryClient } from '@/lib/query-client';

// Post detail edits and deletes show on every screen that has the post at
// once: the trip page, the profile Posts tab, Saved, and post detail itself.

/**
 * Swaps in the server's copy of an edited post. Likes, saves and comment
 * counts stay as they are, since a toggle may still be on its way.
 */
export function storeEditedPost(post: PostResponse) {
  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data;
    const next = updateEverywhere(data, 'post', post.id, (item: PostResponse) => ({
      ...post,
      likeCount: item.likeCount,
      likedByMe: item.likedByMe,
      saveCount: item.saveCount,
      savedByMe: item.savedByMe,
      commentCount: item.commentCount,
    }));
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
  // A new location or rating moves the place's average on the trip's other posts
  void queryClient.invalidateQueries({ queryKey: queryKeys.tripPosts(post.tripId) });
}

/** Drops a deleted post from every list, then refreshes what counts or covers it. */
export function forgetDeletedPost(post: Pick<PostResponse, 'id' | 'tripId' | 'author'>) {
  for (const query of queryClient.getQueryCache().findAll()) {
    const data = query.state.data;
    const next = removeEverywhere(data, 'post', post.id);
    if (next !== data) queryClient.setQueryData(query.queryKey, next);
  }
  // The trip's post count and cover photo come from its posts
  void queryClient.invalidateQueries({ queryKey: queryKeys.trip(post.tripId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.tripPosts(post.tripId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.userTrips(post.author.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.userPosts(post.author.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
}
