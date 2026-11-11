import { Prisma } from '../generated/prisma/client';
import {
  ratedLocationIds,
  refreshLocationRatings,
} from '../locations/location-ratings';
import { lockOwnerTripsForUpdate } from '../trips/trip-locks';

// Deletes the user's row, for DELETE /api/me and Clerk's user.deleted webhook.
// The delete cascades to their trips and posts, so the places those posts
// rated are recomputed in the same transaction. The trips are locked first so
// no post goes in between reading the places and deleting.
export async function deleteUserRows(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await lockOwnerTripsForUpdate(tx, userId);
  const locationIds = await ratedLocationIds(tx, {
    trip: { ownerId: userId },
  });
  await tx.user.deleteMany({ where: { id: userId } });
  await refreshLocationRatings(tx, locationIds);
}

// Prisma's 5s default is tight for a user with many trips
export const DELETE_USER_TX_OPTIONS = { timeout: 30_000 };
