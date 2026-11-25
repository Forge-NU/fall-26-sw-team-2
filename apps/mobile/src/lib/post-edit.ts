// Editing a post from post detail (#43 POST-3). Rules from UpdatePostDto,
// RATE-1 (#91), LOC-2 (#94) and POST-4 (#143).
import type { PostResponse, UpdatePostRequest } from 'shared-types';

import { POST_LIMITS } from '@/lib/post-form';
import { canRateLocation, isCustomNameTooLong, type PickedLocation } from '@/lib/picked-location';
import { isSameRatablePlace } from '@/lib/rating';
import { charCount } from '@/lib/trip-form';

export type PostEditValues = {
  caption: string;
  /** null for no location, which is allowed (#143 POST-4) */
  location: PickedLocation | null;
  /** 1-5, or null for no rating */
  rating: number | null;
};

export type PostEditErrors = Partial<Record<'location' | 'caption', string>>;

/** The post's location the way LocationPicker holds it. A dropped pin is a `custom` provider row. */
export function postLocation(post: Pick<PostResponse, 'location' | 'customLocationName'>): PickedLocation | null {
  if (post.location) {
    return post.location.provider === 'custom'
      ? { kind: 'pin', location: post.location }
      : { kind: 'mapbox', location: post.location };
  }
  if (post.customLocationName) return { kind: 'custom', name: post.customLocationName };
  return null;
}

export function postEditValues(post: PostResponse): PostEditValues {
  return { caption: post.caption ?? '', location: postLocation(post), rating: post.rating };
}

/**
 * A new pick in the location field. Like the composer (RATE-2), a rating
 * belongs to one place, so a different place, a custom name or no location
 * starts unrated.
 */
export function withLocation(values: PostEditValues, location: PickedLocation | null): PostEditValues {
  return { ...values, location, rating: isSameRatablePlace(values.location, location) ? values.rating : null };
}

/** The rating that gets saved: a custom name or no location can't have one. */
export function effectiveRating(values: PostEditValues): number | null {
  return canRateLocation(values.location) ? values.rating : null;
}

export function validatePostEdit(values: PostEditValues): PostEditErrors {
  const errors: PostEditErrors = {};
  if (values.location?.kind === 'custom' && isCustomNameTooLong(values.location.name.trim())) {
    errors.location = 'Keep the place name under 100 characters.';
  }
  if (charCount(values.caption.trim()) > POST_LIMITS.caption) {
    errors.caption = `Keep it under ${POST_LIMITS.caption.toLocaleString('en-US')} characters.`;
  }
  return errors;
}

/** Only what changed, for PATCH /api/posts/:id. Empty when nothing did. */
export function toUpdatePostRequest(post: PostResponse, values: PostEditValues): UpdatePostRequest {
  const changes: UpdatePostRequest = {};

  const caption = values.caption.trim() || null;
  if (caption !== post.caption) changes.caption = caption;

  const location = values.location;
  if (location === null) {
    // Removing the location takes both fields as null; a lone null is a 400
    if (post.location || post.customLocationName) {
      changes.locationId = null;
      changes.customLocationName = null;
    }
  } else if (location.kind === 'custom') {
    const name = location.name.trim();
    if (post.location || name !== post.customLocationName) changes.customLocationName = name;
  } else if (location.location.id !== post.location?.id) {
    // A Mapbox place or a dropped pin: both are locations rows
    changes.locationId = location.location.id;
  }

  // The API clears the rating itself when the post moves to a custom name or
  // no location, and won't take one with them
  const rating = effectiveRating(values);
  if (rating !== post.rating && canRateLocation(location)) changes.rating = rating;

  return changes;
}
