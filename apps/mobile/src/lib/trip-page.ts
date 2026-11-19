// Logic for the trip page (app/trips/[id]), kept free of React Native so the
// node tests can import it.
import type { PostResponse, TripResponse } from 'shared-types';

import { groupByPlace } from '@/lib/post-location';

export type DayPlace = {
  key: string;
  name: string;
  /** The city, or the address when there's no city. Null for custom places. */
  subtitle: string | null;
  /** First photo (not video) of the first post there that has one, if any. */
  coverUrl?: string;
  /** Placeholder tint seed for `Media`. */
  coverSeed: string;
  postCount: number;
};

/**
 * "The day, at a glance": each place in the order it was visited. A place
 * visited twice with something in between shows twice, like the post list.
 * Posts with no location (#143 POST-4) aren't a stop, so they're left out.
 */
export function dayPlaces(posts: PostResponse[]): DayPlace[] {
  return groupByPlace(posts).flatMap((group, i) => {
    if (group.key === null || group.name === null) return [];
    const first = group.posts[0];
    const location = first.location;
    let cover: { url: string; seed: string } | undefined;
    for (const post of group.posts) {
      const photo = post.media.find((item) => item.mediaType === 'image');
      if (photo) {
        cover = { url: photo.url, seed: post.id };
        break;
      }
    }
    return [
      {
        key: `${group.key}-${i}`,
        name: group.name,
        subtitle: location?.city ?? location?.address ?? null,
        coverUrl: cover?.url,
        coverSeed: cover?.seed ?? first.id,
        postCount: group.posts.length,
      },
    ];
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
