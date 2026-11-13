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

// The API deletes a pin nobody used after 24 hours, so a post draft retried
// later gets "Location not found" for it. The fix is to drop the same pin again.
export function isExpiredPinError(
  value: PickedLocation,
  status: number,
  message: string,
): value is Extract<PickedLocation, { kind: 'pin' }> {
  return value.kind === 'pin' && status === 400 && message.includes('Location not found');
}

// Too long for a custom name or a pin, counted in code points like Postgres
export function isCustomNameTooLong(name: string): boolean {
  return [...name].length > CUSTOM_LOCATION_MAX;
}
