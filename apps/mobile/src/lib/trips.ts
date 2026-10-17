// Trip rules the story composer needs on the client. The API enforces the same
// rules (apps/api/src/trips/trip-rules.ts); these keep the UI from offering
// choices the server would reject.
import type { CreateTripRequest, TripResponse } from '@/api/types';
import { isDateWithin } from '@/utils/local-date';

// A draft whose dates include today. Only active trips can have stories.
export function isActiveTrip(
  trip: Pick<TripResponse, 'status' | 'startDate' | 'endDate'>,
  today: string,
): boolean {
  return trip.status === 'draft' && isDateWithin(today, trip.startDate, trip.endDate);
}

// The trip the composer preselects: the active trip that started most recently.
export function pickSuggestedTrip(trips: TripResponse[], today: string): TripResponse | null {
  return (
    trips
      .filter((trip) => isActiveTrip(trip, today))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

// STAND-IN (field checks only): TRIP-2 (#41) builds the create-trip form with
// the same title, destination and date checks. Reuse its validation once it
// lands; the "dates must include today" rule is specific to stories and stays.
//
// Checks a quick-create trip from the story composer. Its dates have to
// include today so the new trip is active and the story can link to it.
// Returns an error message, or null when it's valid.
export function validateQuickTrip(trip: CreateTripRequest, today: string): string | null {
  const title = trip.title.trim();
  const destination = trip.destination.trim();
  if (title.length < 1 || title.length > 100) return 'Title must be 1 to 100 characters.';
  if (destination.length < 1 || destination.length > 100) {
    return 'Destination must be 1 to 100 characters.';
  }
  if (trip.endDate < trip.startDate) return "End date can't be before the start date.";
  if (!isDateWithin(today, trip.startDate, trip.endDate)) {
    return 'Dates must include today to post a story to this trip.';
  }
  return null;
}
