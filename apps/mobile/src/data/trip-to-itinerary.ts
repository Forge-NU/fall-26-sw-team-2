import type { FeedItem, PostResponse } from '@/api/feed';
import type { DayPlace, Itinerary, Moment, TripDay } from '@/data/mock';
import { formatTimeAgo, tripDayNumber } from '@/utils/dates';

/**
 * Turns an FYP item from the API into the Itinerary shape the feed card and day
 * screen draw. Each post is a stop; posts are grouped into days by visitedOn.
 * Fields the API doesn't have yet (likes, comments, saves, participants) are empty.
 */
export function toItinerary({ trip, posts }: FeedItem, now = new Date()): Itinerary {
  return {
    id: trip.id,
    title: trip.title,
    summary: trip.description ?? '',
    location: trip.destination,
    postedAgo: trip.publishedAt ? formatTimeAgo(trip.publishedAt, now) : '',
    postKind: 'Sharing itinerary',
    stops: posts.length,
    author: {
      id: trip.owner.id,
      name: `${trip.owner.firstName} ${trip.owner.lastName}`,
      avatarUrl: trip.owner.avatarUrl ?? undefined,
    },
    participants: [],
    days: toDays(trip.title, trip.startDate, posts),
    // TODO: real counts once likes, saves (#49) and comments (#50) have endpoints.
    likes: 0,
    comments: 0,
    saves: 0,
    caption: firstCaption(posts),
    lovedBy: '',
    feeds: ['fyp'],
  };
}

function toDays(tripTitle: string, startDate: string, posts: PostResponse[]): TripDay[] {
  const postsByDay = new Map<number, PostResponse[]>();
  for (const post of posts) {
    const day = tripDayNumber(post.visitedOn, startDate);
    postsByDay.set(day, [...(postsByDay.get(day) ?? []), post]);
  }

  const days = [...postsByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, dayPosts]) => toDay(day, dayPosts));

  // Published trips always have a post, but the card needs a day to draw.
  return days.length > 0 ? days : [{ day: 1, title: tripTitle, summary: '', moments: [], places: [] }];
}

function toDay(day: number, posts: PostResponse[]): TripDay {
  const title = [...new Set(posts.map(placeName))].slice(0, 2).join(' & ');
  const moments = posts.flatMap((post) =>
    post.media.map(
      (media): Moment => ({
        id: media.id,
        kind: media.mediaType === 'video' ? 'video' : 'photo',
        // Videos have no thumbnail yet, so they draw a placeholder.
        imageUrl: media.mediaType === 'image' ? media.url : undefined,
        caption: post.caption ?? placeName(post),
        duration: media.durationMs != null ? formatDuration(media.durationMs) : undefined,
      }),
    ),
  );
  // Only the lead moment of a day shows a title.
  if (moments[0]) moments[0] = { ...moments[0], title };

  const places = posts.map(
    (post): DayPlace => ({ id: post.id, name: placeName(post), note: post.caption ?? '' }),
  );

  return {
    day,
    title,
    summary: firstCaption(posts),
    coverUrl: moments.find((moment) => moment.imageUrl)?.imageUrl,
    moments,
    places,
  };
}

function placeName(post: PostResponse) {
  return post.location?.name ?? post.customLocationName ?? 'Somewhere';
}

function firstCaption(posts: PostResponse[]) {
  return posts.find((post) => post.caption)?.caption ?? '';
}

/** "0:12" */
function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
