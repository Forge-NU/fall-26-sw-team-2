import { Prisma } from '../generated/prisma/client';
import { LocationRating } from './location.types';

// A place's rating is the average of the ratings on posts there in published
// trips (drafts are hidden from everyone but the owner, see trip-rules.ts).
// The totals live on locations.rating_count and rating_sum so search can
// filter with rating_sum >= min * rating_count.

// Recomputes the totals for these locations from their posts. Call it in the
// same transaction as any write that changes which rated posts count toward a
// place: a post created, deleted, or with its rating or location changed, and
// a trip published or deleted. Recomputing instead of adding and subtracting
// means the totals can't drift. A caller may skip it when no counted rating
// can change (an unrated post, or a post in a draft trip), which saves locking
// the location.
//
// Callers make their own change first. The locations are then locked, in id
// order so two callers can't deadlock, and the totals are computed in a new
// statement, which under READ COMMITTED sees everything committed before the
// lock was granted. So whichever transaction gets the lock last counts
// everyone's changes. NO KEY UPDATE rather than UPDATE, since the
// posts.location_id foreign key takes KEY SHARE on the location when a post
// is written, and UPDATE would conflict with that.
export async function refreshLocationRatings(
  tx: Prisma.TransactionClient,
  locationIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(locationIds.filter((id) => id != null))].sort();
  if (ids.length === 0) return;

  await tx.$queryRaw`
    SELECT id FROM locations WHERE id = ANY(${ids}::uuid[])
    ORDER BY id FOR NO KEY UPDATE`;
  await tx.$executeRaw`
    UPDATE locations l SET (rating_count, rating_sum) = (
      SELECT count(p.rating), coalesce(sum(p.rating), 0)
      FROM posts p JOIN trips t ON t.id = p.trip_id
      WHERE p.location_id = l.id AND t.status = 'published'
    )
    WHERE l.id = ANY(${ids}::uuid[])`;
}

// The distinct locations of the rated posts matching `where`, for writes that
// touch many posts at once (publishing or deleting a trip, deleting a user).
// GROUP BY dedups in the database.
export async function ratedLocationIds(
  tx: Prisma.TransactionClient,
  where: Prisma.PostWhereInput,
): Promise<(string | null)[]> {
  const rows = await tx.post.groupBy({
    by: ['locationId'],
    where: { ...where, rating: { not: null }, locationId: { not: null } },
  });
  return rows.map((r) => r.locationId);
}

// null until a place has a rating. The average is rounded to one decimal;
// multiplying first keeps it integer math, so 4.35 rounds to 4.4.
export function toLocationRating(totals: {
  ratingCount: number;
  ratingSum: number;
}): LocationRating | null {
  if (totals.ratingCount === 0) return null;
  return {
    average: Math.round((totals.ratingSum * 10) / totals.ratingCount) / 10,
    count: totals.ratingCount,
  };
}
