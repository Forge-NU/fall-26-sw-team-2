import type { TripResponse } from 'shared-types';

import type { TripDayPreview } from '@/components/content/trip-card';
import { Itineraries, type FeedTab, type Itinerary } from '@/data/mock';
import { addDays } from '@/utils/local-date';

/**
 * One feed card: the trip as the API returns it, plus the extras `TripCard`
 * shows that aren't on `TripResponse` yet.
 */
export type FeedTrip = {
  trip: TripResponse;
  dayPreviews: TripDayPreview[];
  meta: string;
  stops: number;
  verified: boolean;
  caption: string;
  lovedBy: string;
};

// STAND-IN (UI-4 #98): the feed still runs on the mock itineraries in
// data/mock.ts. FEED-2 (#27) swaps feedTrips() for the feed API and keeps the
// screen as is. Likes and comments aren't mapped: they're on posts, not trips.
export function itineraryToTrip(itinerary: Itinerary): TripResponse {
  const [firstName, ...rest] = itinerary.author.name.split(' ');
  const endDate = addDays(itinerary.startDate, itinerary.days.length - 1);
  const publishedAt = `${endDate}T18:00:00.000Z`;
  return {
    id: itinerary.id,
    owner: {
      id: itinerary.author.id,
      firstName,
      lastName: rest.join(' '),
      username: itinerary.author.id,
      avatarUrl: itinerary.author.avatarUrl ?? null,
    },
    title: itinerary.title,
    destination: itinerary.location,
    description: itinerary.summary,
    startDate: itinerary.startDate,
    endDate,
    status: 'published',
    publishedAt,
    postCount: itinerary.days.reduce((total, day) => total + day.moments.length, 0),
    coverImageUrl: itinerary.days[0]?.coverUrl ?? null,
    saveCount: itinerary.saves,
    savedByMe: false,
    createdAt: `${itinerary.startDate}T09:00:00.000Z`,
    updatedAt: publishedAt,
  };
}

export function itineraryToFeedTrip(itinerary: Itinerary): FeedTrip {
  return {
    trip: itineraryToTrip(itinerary),
    dayPreviews: itinerary.days.map((day) => ({
      day: day.day,
      title: day.title,
      coverUrl: day.coverUrl,
      visitedOn: addDays(itinerary.startDate, day.day - 1),
    })),
    meta: [itinerary.location, itinerary.postedAgo, itinerary.postKind].join(' · '),
    stops: itinerary.stops,
    verified: Boolean(itinerary.author.verified),
    caption: itinerary.caption,
    lovedBy: itinerary.lovedBy,
  };
}

/** The cards for one feed tab. */
export function feedTrips(tab: FeedTab): FeedTrip[] {
  return Itineraries.filter((itinerary) => itinerary.feeds.includes(tab)).map(itineraryToFeedTrip);
}
