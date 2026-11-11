// Stories bar and viewer rules (#25 STORY-3). No React Native imports, so
// scripts/stories.test.mjs can test them.
import type { StoryGroup, StoryResponse, UserSummary } from 'shared-types';

/** Drops stories that expired while the screen was open, and users left with none */
export function activeGroups(groups: StoryGroup[], now = Date.now()): StoryGroup[] {
  return groups
    .map((group) => ({ ...group, stories: group.stories.filter((s) => new Date(s.expiresAt).getTime() > now) }))
    .filter((group) => group.stories.length > 0);
}

/** The viewer's own stories go first in the bar, then everyone else in the API's order */
export function ownGroupFirst(groups: StoryGroup[], viewerId: string): StoryGroup[] {
  const own = groups.filter((group) => group.owner.id === viewerId);
  return [...own, ...groups.filter((group) => group.owner.id !== viewerId)];
}

/** Removes one story from the bar, and its user if it was their last */
export function withoutStory(groups: StoryGroup[], storyId: string): StoryGroup[] {
  return groups
    .map((group) => ({ ...group, stories: group.stories.filter((s) => s.id !== storyId) }))
    .filter((group) => group.stories.length > 0);
}

/** The order the viewer taps through: each user's stories, then the next user's */
export function flattenGroups(groups: StoryGroup[]): StoryResponse[] {
  return groups.flatMap((group) => group.stories);
}

/**
 * The story after (or before) `storyId`, or null at either end, where the viewer
 * closes. Crosses from one user's stories to the next.
 */
export function stepStory(stories: StoryResponse[], storyId: string, direction: 1 | -1): StoryResponse | null {
  const index = stories.findIndex((story) => story.id === storyId);
  if (index === -1) return null;
  return stories[index + direction] ?? null;
}

/**
 * Where the viewer goes when the open story leaves the list (`previous` is the
 * list it was last in, `current` the list now): the next story that's still
 * there. After a delete of the last one, the one before it. Null closes the viewer.
 */
export function storyAfterLeaving(
  previous: StoryResponse[],
  current: StoryResponse[],
  storyId: string,
  deleted: boolean,
): StoryResponse | null {
  const index = previous.findIndex((story) => story.id === storyId);
  if (index === -1) return null;
  const stillThere = (story: StoryResponse) => current.some((c) => c.id === story.id);
  const after = previous.slice(index + 1).find(stillThere);
  if (after) return after;
  if (!deleted || index <= 0) return null;
  return previous.slice(0, index).reverse().find(stillThere) ?? null;
}

/** The place name a story shows, from Mapbox or typed in */
export function storyPlaceName(story: Pick<StoryResponse, 'location' | 'customLocationName'>): string | null {
  return story.location?.name ?? story.customLocationName ?? null;
}

export function storyOwnerName(owner: UserSummary): string {
  return `${owner.firstName} ${owner.lastName}`.trim() || owner.username || 'Traveler';
}

/** Short time since posting: "now", "12m", "5h", "2d" */
export function storyAge(createdAt: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** A trip's kept stories from one day (YYYY-MM-DD), in the order the API sorted them */
export function storiesOnDay<T extends Pick<StoryResponse, 'storyDate'>>(stories: T[], day: string): T[] {
  return stories.filter((story) => story.storyDate === day);
}
