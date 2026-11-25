import { INestApplication } from '@nestjs/common';
import { Location, Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ratedLocationIds,
  refreshLocationRatings,
} from '../src/locations/location-ratings';
import { createTestApp, createTestUser } from './utils/test-app';

// refreshLocationRatings against Postgres: the SQL counts what it should, and
// a recompute fixes totals however wrong they were.
describe('refreshLocationRatings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: User;
  let published: Trip;
  let draft: Trip;
  let rated: Location;
  let empty: Location;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    user = await createTestUser(prisma, 'refresh');
    const trip = (status: 'draft' | 'published') =>
      prisma.trip.create({
        data: {
          ownerId: user.id,
          title: status,
          destination: 'Lisbon',
          startDate: new Date('2026-09-12'),
          endDate: new Date('2026-09-16'),
          status,
          publishedAt: status === 'published' ? new Date() : null,
        },
      });
    [published, draft] = await Promise.all([trip('published'), trip('draft')]);
    [rated, empty] = await Promise.all(
      ['rated', 'empty'].map((name) =>
        prisma.location.create({
          data: {
            provider: 'mapbox',
            providerPlaceId: `test.refresh.${user.id}.${name}`,
            name,
            latitude: 38.7,
            longitude: -9.2,
          },
        }),
      ),
    );

    const post = (tripId: string, rating: number | null) =>
      prisma.post.create({
        data: {
          tripId,
          locationId: rated.id,
          rating,
          visitedOn: new Date('2026-09-13'),
        },
      });
    await post(published.id, 5);
    await post(published.id, 2);
    await post(published.id, null); // unrated
    await post(draft.id, 1); // draft, not counted
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.location.deleteMany({
      where: { id: { in: [rated.id, empty.id] } },
    });
    await app.close();
  });

  const totals = (location: Location) =>
    prisma.location.findUniqueOrThrow({
      where: { id: location.id },
      select: { ratingCount: true, ratingSum: true },
    });

  it('recomputes from rated posts on published trips, fixing drifted totals', async () => {
    // Wrong on purpose
    await prisma.location.updateMany({
      where: { id: { in: [rated.id, empty.id] } },
      data: { ratingCount: 7, ratingSum: 30 },
    });

    await prisma.$transaction((tx) =>
      refreshLocationRatings(tx, [rated.id, empty.id, rated.id, null]),
    );

    await expect(totals(rated)).resolves.toEqual({
      ratingCount: 2,
      ratingSum: 7,
    });
    // No posts at all
    await expect(totals(empty)).resolves.toEqual({
      ratingCount: 0,
      ratingSum: 0,
    });
  });

  it('leaves locations it was not given alone', async () => {
    await prisma.location.update({
      where: { id: empty.id },
      data: { ratingCount: 1, ratingSum: 3 },
    });

    await prisma.$transaction((tx) => refreshLocationRatings(tx, [rated.id]));

    await expect(totals(empty)).resolves.toEqual({
      ratingCount: 1,
      ratingSum: 3,
    });
  });

  it('finds the places of rated posts, drafts included', async () => {
    await expect(
      prisma.$transaction((tx) => ratedLocationIds(tx, { tripId: draft.id })),
    ).resolves.toEqual([rated.id]);
  });
});
