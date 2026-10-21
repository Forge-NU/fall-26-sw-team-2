// Trip field rules from DOC-1 (#33), checked before saving so the form can
// highlight fields instead of waiting on a 400
import type { CreateTripRequest, UpdateTripRequest } from '@/api/types';
import { isDateWithin } from '@/utils/local-date';

export type TripFormValues = {
  title: string;
  destination: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
};

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export const TRIP_LIMITS = { title: 100, destination: 100, description: 1000 } as const;

// Counts code points, the way Postgres does, so ❤️ is 2
export function charCount(text: string): number {
  return [...text].length;
}

// postDates: visitedOn of the trip's posts, which have to stay within the dates
export function validateTripForm(values: TripFormValues, postDates: string[] = []): TripFormErrors {
  const errors: TripFormErrors = {};
  const title = values.title.trim();
  const destination = values.destination.trim();

  if (!title) errors.title = 'Add a trip name.';
  else if (charCount(title) > TRIP_LIMITS.title) errors.title = `Keep it under ${TRIP_LIMITS.title} characters.`;

  if (!destination) errors.destination = 'Add a destination.';
  else if (charCount(destination) > TRIP_LIMITS.destination) {
    errors.destination = `Keep it under ${TRIP_LIMITS.destination} characters.`;
  }

  if (charCount(values.description.trim()) > TRIP_LIMITS.description) {
    errors.description = `Keep it under ${TRIP_LIMITS.description} characters.`;
  }

  if (!values.startDate) errors.startDate = 'Pick a start date.';
  if (!values.endDate) errors.endDate = 'Pick an end date.';
  if (values.startDate && values.endDate) {
    if (values.endDate < values.startDate) {
      errors.endDate = "End date can't be before the start date.";
    } else {
      const outside = postDates.filter((date) => !isDateWithin(date, values.startDate!, values.endDate!));
      if (outside.length > 0) {
        errors.endDate = `${outside.length} ${outside.length === 1 ? 'post is' : 'posts are'} outside these dates. Move or delete ${outside.length === 1 ? 'it' : 'them'} first.`;
      }
    }
  }

  return errors;
}

export function hasErrors(errors: TripFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function toCreateTripRequest(values: TripFormValues): CreateTripRequest {
  const description = values.description.trim();
  return {
    title: values.title.trim(),
    destination: values.destination.trim(),
    ...(description && { description }),
    startDate: values.startDate!,
    endDate: values.endDate!,
  };
}

// Only the fields that changed. An emptied description is sent as null to clear it.
export function toUpdateTripRequest(initial: TripFormValues, values: TripFormValues): UpdateTripRequest {
  const next = toCreateTripRequest(values);
  const body: UpdateTripRequest = {};
  if (next.title !== initial.title.trim()) body.title = next.title;
  if (next.destination !== initial.destination.trim()) body.destination = next.destination;
  if ((next.description ?? '') !== initial.description.trim()) body.description = next.description ?? null;
  if (next.startDate !== initial.startDate) body.startDate = next.startDate;
  if (next.endDate !== initial.endDate) body.endDate = next.endDate;
  return body;
}
