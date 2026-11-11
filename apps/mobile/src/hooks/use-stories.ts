import { useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { StoriesFeedResponse, StoryResponse } from 'shared-types';

import { queryKeys } from '@/api/query-keys';
import { deleteStory, getStoriesFeed, getTripStories } from '@/api/stories';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useCurrentUser } from '@/lib/current-user';
import { activeGroups, ownGroupFirst, withoutStory } from '@/lib/stories';

// The stories bar, the viewer's own stories first. Stories that expire while
// it's open drop out on the next render, without a refetch.
export function useStoriesFeed() {
  const user = useCurrentUser();
  const list = useInfiniteList({
    queryKey: queryKeys.storiesFeed,
    fetchPage: (cursor) => getStoriesFeed(cursor),
  });
  return { ...list, groups: ownGroupFirst(activeGroups(list.items), user.id) };
}

// The trip page groups stories by day, so it loads every page up front
export function useTripStories(tripId: string) {
  return useQuery({
    queryKey: queryKeys.tripStories(tripId),
    queryFn: async () => {
      const items: StoryResponse[] = [];
      let cursor: string | null = null;
      do {
        const page = await getTripStories(tripId, cursor);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return items;
    },
  });
}

type FeedData = InfiniteData<StoriesFeedResponse, string | null>;

export function useDeleteStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (story: StoryResponse) => deleteStory(story.id),
    onSuccess: (_, story) => {
      // Drop it from the bar right away, so the viewer doesn't show it again
      queryClient.setQueryData<FeedData>(queryKeys.storiesFeed, (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({ ...page, items: withoutStory(page.items, story.id) })),
        },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.storiesFeed });
      if (story.tripId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tripStories(story.tripId) });
      }
    },
  });
}
