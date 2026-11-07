import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import type { PaginatedResponse } from 'shared-types';

import { followUser, unfollowUser, type FollowListUser, type FollowStatus } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import type { ProfileResponse } from '@/api/users';
import { adjustCount, setFollowingInPages } from '@/lib/follow-cache';

type FollowPages = InfiniteData<PaginatedResponse<FollowListUser>>;

const isFollowList = (key: QueryKey) => key[0] === 'users' && (key[2] === 'followers' || key[2] === 'following');

/**
 * Follows or unfollows `userId` optimistically: the button, the counts on both
 * profiles and every loaded follow list change at once, and change back (with the
 * mutation's error toast) if the request fails.
 */
export function useFollow(userId: string) {
  const queryClient = useQueryClient();

  // Sets the cache as if `follow` had happened. Undoing a failed request applies the
  // opposite, rather than restoring a snapshot, so a follow on someone else that
  // landed in the meantime isn't rolled back with it.
  const apply = (follow: boolean) => {
    const delta = follow ? 1 : -1;
    queryClient.setQueryData<FollowStatus>(queryKeys.followStatus(userId), { isFollowing: follow });
    queryClient.setQueryData<ProfileResponse>(queryKeys.profile(userId), (profile) =>
      adjustCount(profile, 'followerCount', delta),
    );
    queryClient.setQueryData<ProfileResponse>(queryKeys.myProfile, (me) => adjustCount(me, 'followingCount', delta));
    queryClient.setQueriesData<FollowPages>({ predicate: (query) => isFollowList(query.queryKey) }, (data) =>
      setFollowingInPages(data, userId, follow),
    );
  };

  const mutation = useMutation({
    mutationFn: (follow: boolean) => (follow ? followUser(userId) : unfollowUser(userId)),
    onMutate: async (follow) => {
      await Promise.all([
        ...[queryKeys.followStatus(userId), queryKeys.profile(userId), queryKeys.myProfile].map((queryKey) =>
          queryClient.cancelQueries({ queryKey, exact: true }),
        ),
        queryClient.cancelQueries({ predicate: (query) => isFollowList(query.queryKey) }),
      ]);
      apply(follow);
    },
    onError: (_error, follow) => apply(!follow),
    onSettled: () => {
      for (const queryKey of [queryKeys.followStatus(userId), queryKeys.profile(userId), queryKeys.myProfile]) {
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
