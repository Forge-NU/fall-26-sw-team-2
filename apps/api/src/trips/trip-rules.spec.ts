import { BadRequestException } from '@nestjs/common';
import { parseDateOnly } from '../common/dates';
import { canViewTrip, isActiveTrip, resolveToday } from './trip-rules';

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
