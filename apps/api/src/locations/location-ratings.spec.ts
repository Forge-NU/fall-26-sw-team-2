import { Prisma } from '../generated/prisma/client';
import {
  ratedLocationIds,
  refreshLocationRatings,
  toLocationRating,
} from './location-ratings';

// The SQL itself runs against Postgres in test/location-ratings.e2e-spec.ts.
// These cover what happens around it.

function makeTx() {
  const calls: string[] = [];
  const tx = {
    $queryRaw: jest.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        void values;
        calls.push(strings.join('?'));
        return Promise.resolve([]);
      },
    ),
    $executeRaw: jest.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        void values;
        calls.push(strings.join('?'));
        return Promise.resolve(0);
      },
    ),
    post: { findMany: jest.fn() },
  };
  return { tx, calls, client: tx as unknown as Prisma.TransactionClient };
}

describe('refreshLocationRatings', () => {
  it('locks the locations in id order, then recomputes them in a new statement', async () => {
    const { tx, calls, client } = makeTx();

    await refreshLocationRatings(client, ['loc_b', null, 'loc_a', 'loc_b']);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/ORDER BY id FOR NO KEY UPDATE/);
    expect(calls[1]).toMatch(/UPDATE locations/);
    expect(calls[1]).toMatch(/t\.status = 'published'/);
    // Nulls dropped, deduped and sorted, for both statements
    expect(tx.$queryRaw.mock.calls[0][1]).toEqual(['loc_a', 'loc_b']);
    expect(tx.$executeRaw.mock.calls[0][1]).toEqual(['loc_a', 'loc_b']);
  });

  it('does nothing without a location', async () => {
    const { calls, client } = makeTx();

    await refreshLocationRatings(client, []);
    await refreshLocationRatings(client, [null, undefined]);

    expect(calls).toHaveLength(0);
  });
});

describe('ratedLocationIds', () => {
  it('returns the distinct places of the rated posts', async () => {
    const { tx, client } = makeTx();
    tx.post.findMany.mockResolvedValue([
      { locationId: 'loc_a' },
      { locationId: 'loc_b' },
    ]);

    await expect(
      ratedLocationIds(client, { tripId: 'trip_1' }),
    ).resolves.toEqual(['loc_a', 'loc_b']);
    expect(tx.post.findMany).toHaveBeenCalledWith({
      where: {
        tripId: 'trip_1',
        rating: { not: null },
        locationId: { not: null },
      },
      select: { locationId: true },
      distinct: ['locationId'],
    });
  });
});

describe('toLocationRating', () => {
  it('is null until a place has a rating', () => {
    expect(toLocationRating({ ratingCount: 0, ratingSum: 0 })).toBeNull();
  });

  it('averages, rounded to one decimal', () => {
    expect(toLocationRating({ ratingCount: 1, ratingSum: 4 })).toEqual({
      average: 4,
      count: 1,
    });
    expect(toLocationRating({ ratingCount: 3, ratingSum: 13 })).toEqual({
      average: 4.3,
      count: 3,
    });
    expect(toLocationRating({ ratingCount: 2, ratingSum: 9 })).toEqual({
      average: 4.5,
      count: 2,
    });
    expect(toLocationRating({ ratingCount: 3, ratingSum: 5 })).toEqual({
      average: 1.7,
      count: 3,
    });
  });

  it('rounds halves up without float error', () => {
    // 87 / 20 = 4.35, which is 4.3499... as a float
    expect(toLocationRating({ ratingCount: 20, ratingSum: 87 })?.average).toBe(
      4.4,
    );
  });
});
