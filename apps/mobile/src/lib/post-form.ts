// Post field rules from DOC-1 (#33)
import type { TripResponse } from '@/api/types';
import type { PickedLocation } from '@/components/location/location-picker';
import { pickSuggestedTrip } from '@/lib/trips';
import { charCount } from '@/lib/trip-form';
import { isDateWithin } from '@/utils/local-date';

export const POST_LIMITS = { media: 30, caption: 2200 } as const;

export type PostFormErrors = Partial<Record<'trip' | 'photos' | 'location' | 'caption', string>>;

// Today if it's within the trip's dates, otherwise the trip's start date.
// A requested day (from the trip page) wins when it's within the dates.
export function defaultVisitedOn(trip: TripResponse, today: string, requested?: string | null): string {
  if (requested && isDateWithin(requested, trip.startDate, trip.endDate)) return requested;
  return isDateWithin(today, trip.startDate, trip.endDate) ? today : trip.startDate;
}

// Opened from the Create tab with no trip: the active trip, else the newest draft,
// else the newest trip
export function suggestTrip(trips: TripResponse[], today: string): TripResponse | null {
  return (
    pickSuggestedTrip(trips, today) ??
    trips.find((trip) => trip.status === 'draft') ??
    trips[0] ??
    null
  );
}

export function validatePostForm(values: {
  trip: TripResponse | null;
  photoCount: number;
  location: PickedLocation | null;
  caption: string;
}): PostFormErrors {
  const errors: PostFormErrors = {};
  if (!values.trip) errors.trip = 'Choose a trip.';
  if (values.photoCount < 1) errors.photos = 'Add at least one photo.';
  else if (values.photoCount > POST_LIMITS.media) errors.photos = `A post can have up to ${POST_LIMITS.media} photos.`;
  if (!values.location) errors.location = 'Add a location.';
  if (charCount(values.caption.trim()) > POST_LIMITS.caption) {
    errors.caption = `Keep it under ${POST_LIMITS.caption.toLocaleString('en-US')} characters.`;
  }
  return errors;
}
