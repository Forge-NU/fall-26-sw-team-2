// What the location picker returns, and how it goes on a post or story. Kept
// out of the picker component so node --test can import it.
import type { ResolveLocationResponse } from 'shared-types';

// A shared Mapbox place, a pin the user dropped (#94 LOC-2), or just a name
export type PickedLocation = ResolveLocationResponse;

// Matches posts.custom_location_name. A pin's name follows the same rule.
export const CUSTOM_LOCATION_MAX = 100;

export function locationName(value: PickedLocation): string {
  return value.kind === 'custom' ? value.name : value.location.name;
}

// The line under the name in the picker field
export function locationSubtitle(value: PickedLocation): string | null {
  if (value.kind === 'pin') return 'Dropped pin';
  if (value.kind === 'custom') return 'Custom location';
  return [value.location.city, value.location.countryCode].filter(Boolean).join(', ') || null;
}

// The location fields for POST /api/posts and POST /api/stories. A Mapbox
// place and a dropped pin are both locations rows; a custom name isn't.
export function toLocationFields(
  value: PickedLocation,
): { locationId: string } | { customLocationName: string } {
  return value.kind === 'custom' ? { customLocationName: value.name } : { locationId: value.location.id };
}

// Whether a post with this location can be rated: it needs a locationId, so a
// Mapbox place or a dropped pin. A custom name or no location (#143 POST-4)
// can't be. For the composer's "Rate this place" row (#92 RATE-2).
export function canRateLocation(value: PickedLocation | null): boolean {
  return value != null && value.kind !== 'custom';
}

// The API deletes a pin nobody used after 24 hours, so a post draft retried
// later gets "Location not found" for it. The fix is to drop the same pin again.
export function isExpiredPinError(
  value: PickedLocation,
  status: number,
  message: string,
): value is Extract<PickedLocation, { kind: 'pin' }> {
  return value.kind === 'pin' && status === 400 && message.includes('Location not found');
}

// A pin is only ever on one post or story, and only this draft attaches its
// pin. So if the post is rejected but a post in the trip already has the pin,
// an earlier try went through and only its response was lost (a timeout, or
// the app closed). That post is the result, rather than a stuck draft.
export async function findPostWithLocation<T extends { location: { id: string } | null }>(
  locationId: string,
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<T | null> {
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    const match = page.items.find((item) => item.location?.id === locationId);
    if (match) return match;
    cursor = page.nextCursor;
  } while (cursor);
  return null;
}

// Too long for a custom name or a pin, counted in code points like Postgres
export function isCustomNameTooLong(name: string): boolean {
  return [...name].length > CUSTOM_LOCATION_MAX;
}
