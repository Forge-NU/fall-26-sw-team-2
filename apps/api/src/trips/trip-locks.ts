import { Prisma } from '../generated/prisma/client';

// Row locks on a trip, held until the transaction ends. Changes to the trip
// itself (dates, publish, delete) take FOR UPDATE. Post writes take FOR SHARE,
// so they can run alongside each other but not alongside a change that
// depends on the trip's posts, like "no posts outside the new dates" or
// "can't publish without a post".
export async function lockTripForUpdate(
  tx: Prisma.TransactionClient,
  tripId: string,
) {
  await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`;
}

export async function lockTripForShare(
  tx: Prisma.TransactionClient,
  tripId: string,
) {
  await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR SHARE`;
}
