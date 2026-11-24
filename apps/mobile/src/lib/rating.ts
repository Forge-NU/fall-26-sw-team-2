// Star ratings (RATE-2 #92). A post rates its place 1-5 stars; a place shows
// the average of those ratings. Rules from RATE-1 (#91).
import type { PickedLocation } from '@/lib/picked-location';

export const RATING_MAX = 5;

export type StarFill = 'full' | 'half' | 'empty';

/** One fill per star. Averages round to the nearest half star (4.3 → 4½, 4.2 → 4). */
export function starFills(value: number | null): StarFill[] {
  const halves = value == null ? 0 : Math.round(Math.min(Math.max(value, 0), RATING_MAX) * 2);
  return Array.from({ length: RATING_MAX }, (_, i) => {
    const left = halves - i * 2;
    return left >= 2 ? 'full' : left === 1 ? 'half' : 'empty';
  });
}

/** "4" for a whole number, "4.3" otherwise (averages come back with one decimal) */
export function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** What screen readers hear for a shown rating */
export function ratingLabel(value: number | null, count?: number): string {
  if (value == null) return 'No ratings yet';
  const rated = `Rated ${formatRating(value)} out of ${RATING_MAX}`;
  if (count == null) return rated;
  return `${rated} from ${count.toLocaleString('en-US')} ${count === 1 ? 'post' : 'posts'}`;
}

/** The value screen readers hear on the rating input */
export function ratingValueText(value: number | null): string {
  if (value == null) return 'No rating';
  return `${value} of ${RATING_MAX} stars`;
}

/** Tapping a star sets it; tapping the current star again clears the rating. */
export function tapRating(current: number | null, star: number): number | null {
  return current === star ? null : star;
}

/** Screen reader swipe up / down. Down from 1 star clears the rating. */
export function stepRating(current: number | null, step: 1 | -1): number | null {
  const next = (current ?? 0) + step;
  if (next < 1) return null;
  return Math.min(next, RATING_MAX);
}

/**
 * Whether a new pick is the same ratable place as before, so the rating stays.
 * Mapbox places and dropped pins are compared by their locations row; a custom
 * name or no location never matches. Which picks can be rated at all is
 * canRateLocation in lib/picked-location.ts.
 */
export function isSameRatablePlace(before: PickedLocation | null, after: PickedLocation | null): boolean {
  if (!before || !after || before.kind === 'custom' || after.kind === 'custom') return false;
  return before.location.id === after.location.id;
}
