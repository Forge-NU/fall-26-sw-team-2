import { BadRequestException } from '@nestjs/common';
import { Prisma, Trip } from '../generated/prisma/client';
import { daysBetween, parseDateOnly, todayUtc } from '../common/dates';
import type { TripRole } from 'shared-types';

// Shared trip rules from DOC-1 (#33). Feed, map, search, profiles and stories
// should use these instead of rewriting them.

// A trip can be seen by everyone once it's published, and by its owner always.
export function visibleTripWhere(viewerId: string): Prisma.TripWhereInput {
  return { OR: [{ status: 'published' }, { ownerId: viewerId }] };
}

export function canViewTrip(
  viewerId: string,
  trip: Pick<Trip, 'ownerId' | 'status'>,
): boolean {
  return trip.status === 'published' || trip.ownerId === viewerId;
}

// A trip is active when it's a draft and today is within its dates, inclusive.
// Only active trips can have stories linked to them (#23).
export function activeTripWhere(
  ownerId: string,
  today: Date,
): Prisma.TripWhereInput {
  return {
    ownerId,
    status: 'draft',
    startDate: { lte: today },
    endDate: { gte: today },
  };
}

export function isActiveTrip(
  trip: Pick<Trip, 'status' | 'startDate' | 'endDate'>,
  today: Date,
): boolean {
  return (
    trip.status === 'draft' && trip.startDate <= today && today <= trip.endDate
  );
}

// "Today" is the user's local date, sent by the app as YYYY-MM-DD. Every time
// zone is within a day of UTC, so anything further off is rejected. Without a
// date, falls back to the server's UTC date.
export function resolveToday(date?: string, now = new Date()): Date {
  const serverToday = todayUtc(now);
  if (!date) return serverToday;

  const today = parseDateOnly(date);
  if (Math.abs(daysBetween(serverToday, today)) > 1) {
    throw new BadRequestException(
      'date must be within one day of the current date',
    );
  }
  return today;
}

// Shared trips (#129 DOC-3, #131 COLLAB-1)

// A trip has one owner and up to 9 collaborators. Pending invites count too,
// so an owner can't invite more people than fit.
export const MAX_TRIP_PEOPLE = 10;

// The most places one trip's bucket holds
export const MAX_BUCKET_PLACES = 200;

/**
 * The viewer's role on a trip: 'owner', 'collaborator', or null for everyone
 * else, including when the trip doesn't exist. Every shared-trip permission
 * check starts here (see the permission table in
 * docs/architecture/shared-trips.md). One query.
 */
export async function tripRole(
  prisma: Pick<Prisma.TransactionClient, 'trip'>,
  tripId: string,
  viewerId: string,
): Promise<TripRole | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      ownerId: true,
      members: { where: { userId: viewerId }, select: { userId: true } },
    },
  });
  if (!trip) return null;
  if (trip.ownerId === viewerId) return 'owner';
  return trip.members.length > 0 ? 'collaborator' : null;
}
