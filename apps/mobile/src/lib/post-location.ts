// Showing a post's location. It's optional (#143 POST-4), so every helper
// here handles a post with none. Kept out of the components so node --test
// can import it.
import type { PostResponse } from 'shared-types';

type PostLocation = Pick<PostResponse, 'location' | 'customLocationName'>;

// The name to show, or null for a post with no location (show no location row)
export function postPlaceName(post: PostLocation): string | null {
  return post.location?.name ?? post.customLocationName ?? null;
}

// Posts at the same place share a key: the same locations row, or the same
// custom name. null for no location.
export function postPlaceKey(post: PostLocation): string | null {
  if (post.location) return post.location.id;
  return post.customLocationName ? `custom:${post.customLocationName}` : null;
}

// The trip's "places" stat. A post with no location isn't a place.
export function countPlaces(posts: PostLocation[]): number {
  return new Set(posts.map(postPlaceKey).filter((key) => key !== null)).size;
}

export type PlaceGroup<T> = { key: string | null; name: string | null; posts: T[] };

// Back-to-back posts at the same place share one header on the trip page.
// Back-to-back posts with no location share a group with no header (name null),
// so they're never shown under a place.
export function groupByPlace<T extends PostLocation>(posts: T[]): PlaceGroup<T>[] {
  const groups: PlaceGroup<T>[] = [];
  for (const post of posts) {
    const key = postPlaceKey(post);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.posts.push(post);
    else groups.push({ key, name: postPlaceName(post), posts: [post] });
  }
  return groups;
}
