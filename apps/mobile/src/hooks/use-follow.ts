import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import type { FollowListUser, FollowStatus, PaginatedResponse, UserResponse , SearchPage } from 'shared-types';

import { followUser, unfollowUser } from '@/api/profiles';
import { queryKeys } from '@/api/query-keys';
import { adjustCount, setFollowingInPages, setFollowingInSearch } from '@/lib/follow-cache';

type FollowPages = InfiniteData<PaginatedResponse<FollowListUser>>;

const isFollowList = (key: QueryKey) => key[0] === 'users' && (key[2] === 'followers' || key[2] === 'following');

/**
 * Follows or unfollows `userId` optimistically: the button, the counts on both
 * profiles, every loaded follow list and people search results change at once,
 * and change back (with the mutation's error toast) if the request fails.
 */
export function useFollow(userId: string) {
  const queryClient = useQueryClient();

  // Sets the cache as if `follow` had happened. Undoing a failed request applies the
  // opposite, rather than restoring a snapshot, so a follow on someone else that
  // landed in the meantime isn't rolled back with it.
  const apply = (follow: boolean) => {
    const delta = follow ? 1 : -1;
    queryClient.setQueryData<FollowStatus>(queryKeys.followStatus(userId), { isFollowing: follow });
    queryClient.setQueryData<UserResponse>(queryKeys.profile(userId), (profile) =>
      adjustCount(profile, 'followerCount', delta),
    );
    queryClient.setQueryData<UserResponse>(queryKeys.myProfile, (me) => adjustCount(me, 'followingCount', delta));
    queryClient.setQueriesData<FollowPages>({ predicate: (query) => isFollowList(query.queryKey) }, (data) =>
      setFollowingInPages(data, userId, follow),
    );
    // People search on the Map tab (SRCH-2)
    queryClient.setQueriesData<InfiniteData<SearchPage<'people'>>>({ queryKey: queryKeys.searchPeople }, (data) =>
      setFollowingInSearch(data, userId, follow),
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
        // People searches aren't cancelled: one cut off mid-typing wouldn't run again.
        // A response that started before this follow is corrected by the refetch in onSettled.
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
      // The search on screen refetches (a follow doesn't remove anyone from it); older ones on next use
      void queryClient.invalidateQueries({ queryKey: queryKeys.searchPeople });
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
