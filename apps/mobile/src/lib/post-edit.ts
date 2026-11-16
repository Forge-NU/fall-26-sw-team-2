// Editing a post from post detail (#43 POST-3). Rules from UpdatePostDto and RATE-1 (#91).
import type { PostResponse, UpdatePostRequest } from 'shared-types';

import type { PickedLocation } from '@/components/location/location-picker';
import { POST_LIMITS } from '@/lib/post-form';
import { charCount } from '@/lib/trip-form';

export type PostEditValues = {
  caption: string;
  location: PickedLocation | null;
  /** 1-5, or null for no rating */
  rating: number | null;
};

export type PostEditErrors = Partial<Record<'location' | 'caption', string>>;

/** The post's location the way LocationPicker holds it. */
export function postLocation(post: PostResponse): PickedLocation | null {
  if (post.location) return { kind: 'mapbox', location: post.location };
  if (post.customLocationName) return { kind: 'custom', name: post.customLocationName };
  return null;
}

export function postEditValues(post: PostResponse): PostEditValues {
  return { caption: post.caption ?? '', location: postLocation(post), rating: post.rating };
}

/** Only a Mapbox place can be rated: a custom name isn't a place others can find. */
export function canRate(location: PickedLocation | null): boolean {
  return location?.kind === 'mapbox';
}

/** The rating that gets saved: switching to a custom name clears it. */
export function effectiveRating(values: PostEditValues): number | null {
  return canRate(values.location) ? values.rating : null;
}

export function validatePostEdit(values: PostEditValues): PostEditErrors {
  const errors: PostEditErrors = {};
  if (!values.location) errors.location = 'Add a location.';
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
  if (location?.kind === 'mapbox' && location.location.id !== post.location?.id) {
    changes.locationId = location.location.id;
  } else if (
    location?.kind === 'custom' &&
    (post.location !== null || location.name.trim() !== post.customLocationName)
  ) {
    changes.customLocationName = location.name.trim();
  }

  // The API clears the rating itself on a switch to a custom name, and won't take one with it
  const rating = effectiveRating(values);
  if (changes.customLocationName === undefined && rating !== post.rating) changes.rating = rating;

  return changes;
}
