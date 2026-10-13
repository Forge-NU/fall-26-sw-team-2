import { BadRequestException } from '@nestjs/common';
import { Prisma, Trip } from '../generated/prisma/client';
import { daysBetween, parseDateOnly, todayUtc } from '../common/dates';

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
