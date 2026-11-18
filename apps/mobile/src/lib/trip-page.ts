// Logic for the trip page (app/trips/[id]), kept free of React Native so the
// node tests can import it.
import type { PostResponse, TripResponse } from 'shared-types';

export function postPlaceName(post: PostResponse): string {
  return post.location?.name ?? post.customLocationName ?? 'Unknown place';
}

export type PlaceGroup = { key: string; name: string; posts: PostResponse[] };

/** Back-to-back posts at the same place, grouped in visit order. */
export function groupByPlace(posts: PostResponse[]): PlaceGroup[] {
  const groups: PlaceGroup[] = [];
  for (const post of posts) {
    const key = post.location?.id ?? `custom:${post.customLocationName}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.posts.push(post);
    else groups.push({ key, name: postPlaceName(post), posts: [post] });
  }
  return groups;
}

export type DayPlace = {
  key: string;
  name: string;
  /** The city, or the address when there's no city. Null for custom places. */
  subtitle: string | null;
  /** First photo of the first post there, if any. */
  coverUrl?: string;
  /** Placeholder tint seed for `Media`. */
  coverSeed: string;
  postCount: number;
};

/**
 * "The day, at a glance": each place in the order it was visited. A place
 * visited twice with something in between shows twice, like the post list.
 */
export function dayPlaces(posts: PostResponse[]): DayPlace[] {
  return groupByPlace(posts).map((group, i) => {
    const first = group.posts[0];
    const location = first.location;
    const withMedia = group.posts.find((post) => post.media.length > 0);
    return {
      key: `${group.key}-${i}`,
      name: group.name,
      subtitle: location?.city ?? location?.address ?? null,
      coverUrl: withMedia?.media[0].url,
      coverSeed: withMedia?.id ?? first.id,
      postCount: group.posts.length,
    };
  });
}

/** The `day` route param (YYYY-MM-DD), if it's one of the trip's days. */
export function initialDay(param: string | string[] | undefined, days: string[]): string | null {
  return typeof param === 'string' && days.includes(param) ? param : null;
}

/**
 * What goes to the share sheet; `url` is the trip's deep link. iOS shares
 * `message` and `url` as separate items (the link gets a preview), so the link
 * only goes in the text elsewhere, where `url` is ignored.
 */
export function tripShareContent(
  trip: Pick<TripResponse, 'title' | 'destination'>,
  url: string,
  os: string,
): { message: string; url?: string } {
  const text = `${trip.title} · ${trip.destination}`;
  return os === 'ios' ? { message: text, url } : { message: `${text}\n${url}` };
}
