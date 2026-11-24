import { BadRequestException } from '@nestjs/common';
import { parseDateOnly } from '../common/dates';
import {
  canViewTrip,
  isActiveTrip,
  resolveToday,
  tripRole,
} from './trip-rules';

const d = parseDateOnly;

describe('trip rules', () => {
  describe('isActiveTrip', () => {
    const trip = {
      status: 'draft' as const,
      startDate: d('2026-10-12'),
      endDate: d('2026-10-16'),
    };

    it('is active on the start date, end date, and days between', () => {
      expect(isActiveTrip(trip, d('2026-10-12'))).toBe(true);
      expect(isActiveTrip(trip, d('2026-10-14'))).toBe(true);
      expect(isActiveTrip(trip, d('2026-10-16'))).toBe(true);
    });

    it("isn't active before or after its dates", () => {
      expect(isActiveTrip(trip, d('2026-10-11'))).toBe(false);
      expect(isActiveTrip(trip, d('2026-10-17'))).toBe(false);
    });

    it("isn't active once published, even within its dates", () => {
      expect(
        isActiveTrip({ ...trip, status: 'published' }, d('2026-10-14')),
      ).toBe(false);
    });
  });

  describe('canViewTrip', () => {
    it('lets anyone see a published trip', () => {
      expect(
        canViewTrip('user_b', { ownerId: 'user_a', status: 'published' }),
      ).toBe(true);
    });

    it('only lets the owner see a draft', () => {
      expect(
        canViewTrip('user_a', { ownerId: 'user_a', status: 'draft' }),
      ).toBe(true);
      expect(
        canViewTrip('user_b', { ownerId: 'user_a', status: 'draft' }),
      ).toBe(false);
    });
  });

  describe('resolveToday', () => {
    const now = new Date('2026-10-13T23:30:00Z');

    it("defaults to the server's UTC date", () => {
      expect(resolveToday(undefined, now)).toEqual(d('2026-10-13'));
    });

    it("accepts the user's date up to a day either side", () => {
      expect(resolveToday('2026-10-12', now)).toEqual(d('2026-10-12'));
      expect(resolveToday('2026-10-14', now)).toEqual(d('2026-10-14'));
    });

    it('rejects a date more than a day away', () => {
      expect(() => resolveToday('2026-10-15', now)).toThrow(
        BadRequestException,
      );
      expect(() => resolveToday('2026-10-11', now)).toThrow(
        BadRequestException,
      );
    });
  });
});

describe('tripRole', () => {
  const tripId = '11111111-1111-4111-8111-111111111111';

  // The members relation is already filtered to the viewer, as in the query
  function prismaReturning(
    trip: { ownerId: string; members: { userId: string }[] } | null,
  ) {
    const findUnique = jest.fn<Promise<typeof trip>, [unknown]>(() =>
      Promise.resolve(trip),
    );
    return { prisma: { trip: { findUnique } } as never, findUnique };
  }

  it("is 'owner' for the trip's owner", async () => {
    const { prisma } = prismaReturning({ ownerId: 'owner', members: [] });
    await expect(tripRole(prisma, tripId, 'owner')).resolves.toBe('owner');
  });

  it("is 'collaborator' for a member", async () => {
    const { prisma, findUnique } = prismaReturning({
      ownerId: 'owner',
      members: [{ userId: 'collab' }],
    });
    await expect(tripRole(prisma, tripId, 'collab')).resolves.toBe(
      'collaborator',
    );
    // Only the viewer's own membership is loaded, never the whole list
    const [args] = findUnique.mock.calls[0] as [
      { where: unknown; select: { members: unknown } },
    ];
    expect(args.where).toEqual({ id: tripId });
    expect(args.select.members).toEqual({
      where: { userId: 'collab' },
      select: { userId: true },
    });
  });

  it('is null for a stranger', async () => {
    const { prisma } = prismaReturning({ ownerId: 'owner', members: [] });
    await expect(tripRole(prisma, tripId, 'stranger')).resolves.toBeNull();
  });

  it("is null when the trip doesn't exist", async () => {
    const { prisma } = prismaReturning(null);
    await expect(tripRole(prisma, tripId, 'owner')).resolves.toBeNull();
  });
});
