import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import type { PaginatedResponse } from 'shared-types';

import {
  followUser,
  unfollowUser,
  type FollowListUser,
  type FollowStatus,
  type ProfileResponse,
} from '@/api/profiles';
import { adjustCount, profileKeys, setFollowingInPages } from '@/lib/follow-cache';

type FollowPages = InfiniteData<PaginatedResponse<FollowListUser>>;

const isFollowList = (key: QueryKey) => key[0] === 'users' && (key[2] === 'followers' || key[2] === 'following');

/**
 * Follows or unfollows `userId` optimistically: the button, the counts on both
 * profiles and every loaded follow list change at once, and roll back (with the
 * mutation's error toast) if the request fails.
 */
export function useFollow(userId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (follow: boolean) => (follow ? followUser(userId) : unfollowUser(userId)),
    onMutate: async (follow) => {
      const delta = follow ? 1 : -1;
      const keys = [profileKeys.followStatus(userId), profileKeys.profile(userId), profileKeys.me];
      await Promise.all([
        ...keys.map((queryKey) => queryClient.cancelQueries({ queryKey, exact: true })),
        queryClient.cancelQueries({ predicate: (query) => isFollowList(query.queryKey) }),
      ]);
      const snapshot = [
        ...keys.map((key) => [key, queryClient.getQueryData(key)] as const),
        ...queryClient.getQueriesData({ predicate: (query) => isFollowList(query.queryKey) }),
      ];

      queryClient.setQueryData<FollowStatus>(profileKeys.followStatus(userId), { isFollowing: follow });
      queryClient.setQueryData<ProfileResponse>(profileKeys.profile(userId), (profile) =>
        adjustCount(profile, 'followerCount', delta),
      );
      queryClient.setQueryData<ProfileResponse>(profileKeys.me, (me) => adjustCount(me, 'followingCount', delta));
      queryClient.setQueriesData<FollowPages>({ predicate: (query) => isFollowList(query.queryKey) }, (data) =>
        setFollowingInPages(data, userId, follow),
      );
      return snapshot;
    },
    onError: (_error, _follow, snapshot) => {
      for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      for (const queryKey of [profileKeys.followStatus(userId), profileKeys.profile(userId), profileKeys.me]) {
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
      // Refetched next time a list opens, so the row you just tapped doesn't vanish
      void queryClient.invalidateQueries({
        predicate: (query) => isFollowList(query.queryKey),
        refetchType: 'none',
      });
    },
  });

  return {
    /** Ignored while a request for this user is still out */
    toggle: (isFollowing: boolean) => {
      if (!mutation.isPending) mutation.mutate(!isFollowing);
    },
    isPending: mutation.isPending,
  };
}
