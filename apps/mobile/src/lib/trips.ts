// Client-side versions of the API's trip rules (apps/api/src/trips/trip-rules.ts)
import type { TripResponse } from 'shared-types';

import type { ErrorFallbacks } from '@/api/client';
import { validateTripForm, type TripFormErrors, type TripFormValues } from '@/lib/trip-form';
import { isDateWithin } from '@/utils/local-date';

// For getErrorMessage, when the API doesn't say what went wrong
export const TRIP_ERROR_FALLBACKS = {
  403: "Only the trip's owner can change it.",
  404: "This trip doesn't exist anymore.",
} satisfies ErrorFallbacks;

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

// Quick-create from the story composer: TRIP-2's field rules (#86), plus the
// dates must include today so the trip is active and can take the story
export function validateQuickTrip(values: TripFormValues, today: string): TripFormErrors {
  const errors = validateTripForm(values);
  if (
    values.startDate &&
    values.endDate &&
    !errors.startDate &&
    !errors.endDate &&
    !isDateWithin(today, values.startDate, values.endDate)
  ) {
    errors.endDate = 'Dates must include today to post a story to this trip.';
  }
  return errors;
}
