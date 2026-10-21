// Client-side versions of the API's trip rules (apps/api/src/trips/trip-rules.ts)
import type { CreateTripRequest, TripResponse } from '@/api/types';
import { isDateWithin } from '@/utils/local-date';

// Draft, and today is within its dates
export function isActiveTrip(
  trip: Pick<TripResponse, 'status' | 'startDate' | 'endDate'>,
  today: string,
): boolean {
  return trip.status === 'draft' && isDateWithin(today, trip.startDate, trip.endDate);
}

// Preselect the active trip that started most recently
export function pickSuggestedTrip(trips: TripResponse[], today: string): TripResponse | null {
  return (
    trips
      .filter((trip) => isActiveTrip(trip, today))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

// Quick-create from the story composer. Dates must include today so the trip
// is active. Returns an error message, or null if valid.
// STAND-IN for TRIP-2 (#41): reuse its form validation for the field checks.
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
