import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { SearchModule } from '../src/search/search.module';
import { SearchService } from '../src/search/search.service';
import { SearchPage, SearchPreview, SearchType } from 'shared-types';

jest.mock('../src/auth/clerk.client', () => ({
  clerkClient: {
    authenticateRequest: jest.fn((incoming: Request) =>
      Promise.resolve({
        isAuthenticated:
          incoming.headers.get('authorization') === 'Bearer search-test',
        toAuth: () => ({ userId: 'search-viewer' }),
      }),
    ),
  },
}));

// Requires a migrated test DB. Fixtures live in a private schema and are removed.
const url = process.env.SEARCH_TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;
describeDatabase('Advanced search HTTP + PostgreSQL', () => {
  const schema = `search_test_${randomUUID().replaceAll('-', '')}`;
  let pool: Pool;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let service: SearchService;
  const trips = Array.from({ length: 7 }, () => randomUUID());
  const locations = Array.from({ length: 4 }, () => randomUUID());
  const posts = Array.from({ length: 8 }, () => randomUUID());

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}", public`);
      const migrations = join(__dirname, '../prisma/migrations');
      for (const name of readdirSync(migrations)
        .filter((name) => /^\d/.test(name))
        .sort()) {
        await client.query(
          readFileSync(join(migrations, name, 'migration.sql'), 'utf8'),
        );
      }
    } finally {
      await client.query('RESET search_path');
      client.release();
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: url, options: `-c search_path=${schema},public` },
        { schema },
      ),
    });
    await prisma.user.createMany({
      data: ['search-owner', 'search-viewer'].map((id) => ({
        id,
        email: `${id}@example.com`,
        username: id,
        firstName: 'Lisbon',
        lastName: 'Traveler',
      })),
    });
    await prisma.follow.create({
      data: { followerId: 'search-viewer', followingId: 'search-owner' },
    });
    await prisma.location.createMany({
      data: locations.map((id, i) => ({
        id,
        provider: i === 3 ? 'custom' : 'mapbox',
        providerPlaceId: id,
        name: 'Lisbon place',
        city: 'Lisbon',
        region: 'Lisbon',
        latitude: i === 2 ? 55 : 38.7,
        longitude: i === 2 ? 12 : -9.2,
      })),
    });
    await prisma.trip.createMany({
      data: trips.map((id, i) => ({
        id,
        ownerId: i === 6 ? 'search-viewer' : 'search-owner',
        title: 'Lisbon trip',
        destination: 'Lisbon',
        description: 'Lisbon adventure',
        startDate: new Date(i === 4 ? '2026-06-01' : '2026-09-12'),
        endDate: new Date(i === 4 ? '2026-06-05' : '2026-09-16'),
        status: i >= 5 ? 'draft' : 'published',
        publishedAt: i >= 5 ? null : new Date('2026-10-01T00:00:00Z'),
        createdAt: new Date('2026-09-01T00:00:00Z'),
      })),
    });
    await prisma.post.createMany({
      data: posts.map((id, i) => ({
        id,
        tripId: trips[Math.min(i, 6)],
        locationId:
          i === 7
            ? null
            : locations[i === 2 ? 2 : i === 3 ? 3 : i >= 5 ? 1 : 0],
        customLocationName: i === 7 ? 'Lisbon kitchen' : null,
        caption: 'Lisbon photo',
        visitedOn: new Date(i === 4 ? '2026-06-02' : '2026-09-13'),
        createdAt: new Date('2026-09-20T00:00:00Z'),
      })),
    });
    const module = await Test.createTestingModule({ imports: [SearchModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(StorageService)
      .useValue({
        getReadUrl: (key: string) =>
          Promise.resolve(`https://media.invalid/${key}`),
      })
      .compile();
    app = module.createNestApplication<App>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    service = module.get(SearchService);
  });
  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  });
  const get = (query: Record<string, string | number>) =>
    request(app.getHttpServer())
      .get('/api/search')
      .set('Authorization', 'Bearer search-test')
      .query(query);

  it('registers exactly /api/search and enforces authentication', async () => {
    await request(app.getHttpServer()).get('/api/search?q=Lisbon').expect(401);
    await get({ q: 'Lisbon' }).expect(200);
    await request(app.getHttpServer())
      .get('/api/api/search?q=Lisbon')
      .expect(404);
  });
  it('returns four preview sections capped at three, including follow state', async () => {
    const response = await get({ q: 'Lisbon' }).expect(200);
    const body = response.body as SearchPreview;
    expect(Object.keys(body).sort()).toEqual([
      'people',
      'places',
      'posts',
      'trips',
    ]);
    expect(body.trips).toHaveLength(3);
    expect(body.posts).toHaveLength(3);
    expect(
      body.people.find((user) => user.id === 'search-owner')?.isFollowing,
    ).toBe(true);
    expect(body.places.map((place) => place.id)).toEqual(
      [locations[2], locations[0]].sort().reverse(),
    );
    expect(
      body.places.find((place) => place.id === locations[0])?.postCount,
    ).toBe(3);
    expect(body.places.every((place) => place.rating === null)).toBe(true);
  });
  it('returns empty results for short queries', async () => {
    const response = await get({ q: ' L ' }).expect(200);
    expect(response.body).toEqual({
      people: [],
      places: [],
      trips: [],
      posts: [],
    });
  });
  it('combines date overlap and distance filters without leaking even own drafts', async () => {
    const response = await get({
      q: 'Lisbon',
      type: 'trips',
      from: '2026-09-15',
      to: '2026-09-15',
      lat: 38.7,
      lng: -9.2,
      radiusKm: 10,
    }).expect(200);
    expect(
      (response.body as SearchPage<'trips'>).items
        .map((item) => item.id)
        .sort(),
    ).toEqual([trips[0], trips[1], trips[3]].sort());
    const postResponse = await get({
      q: 'Lisbon',
      type: 'posts',
      from: '2026-09-13',
      to: '2026-09-13',
      lat: 38.7,
      lng: -9.2,
      radiusKm: 10,
    }).expect(200);
    expect(
      (postResponse.body as SearchPage<'posts'>).items
        .map((item) => item.id)
        .sort(),
    ).toEqual([posts[0], posts[1], posts[3]].sort());
  });
  it.each(['relevance', 'newest'] as const)(
    'pages tied sort keys without missing or repeated rows (%s)',
    async (sort) => {
      for (const type of [
        'people',
        'places',
        'trips',
        'posts',
      ] as SearchType[]) {
        const full = await service.page('search-viewer', type, {
          q: 'Lisbon',
          sort,
          limit: 50,
        });
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await service.page('search-viewer', type, {
            q: 'Lisbon',
            sort,
            limit: 1,
            cursor,
          });
          seen.push(...page.items.map((item) => item.id));
          cursor = page.nextCursor ?? undefined;
        } while (cursor && seen.length < 20);
        expect(seen).toEqual(full.items.map((item) => item.id));
        expect(new Set(seen).size).toBe(seen.length);
      }
    },
  );
  it('rejects cursor reuse across filters, viewers and sorts', async () => {
    const page = await service.page('search-viewer', 'trips', {
      q: 'Lisbon',
      limit: 1,
    });
    for (const query of [
      { q: 'Lisbon', sort: 'newest' as const },
      { q: 'Lisbon', from: '2026-09-01' },
      { q: 'other' },
    ]) {
      await expect(
        service.page('search-viewer', 'trips', {
          ...query,
          cursor: page.nextCursor!,
        }),
      ).rejects.toThrow('Invalid search cursor');
    }
    await expect(
      service.page('search-owner', 'trips', {
        q: 'Lisbon',
        cursor: page.nextCursor!,
      }),
    ).rejects.toThrow('Invalid search cursor');
  });
  it('rejects invalid filter combinations with 400', async () => {
    for (const filters of [
      { radiusKm: 10 },
      { minRating: 6 },
      { from: '2026-09-20', to: '2026-09-01' },
      { from: '2026-02-30' },
      { cursor: 'bad!' },
    ]) {
      await get({ q: 'Lisbon', type: 'posts', ...filters }).expect(400);
    }
  });
  it('does not silently ignore a rating filter before RATE-1 is deployed', async () => {
    await get({ q: 'Lisbon', type: 'places', minRating: 4 }).expect(503);
    // RATE-1 column contract simulated only in this private test schema.
    await pool.query(
      `ALTER TABLE "${schema}".locations ADD COLUMN rating_count int NOT NULL DEFAULT 0, ADD COLUMN rating_sum int NOT NULL DEFAULT 0`,
    );
    await prisma.$executeRaw`UPDATE locations SET rating_count = 2, rating_sum = 9 WHERE id = ${locations[0]}::uuid`;
    const response = await get({
      q: 'Lisbon',
      type: 'places',
      minRating: 4,
      lat: 38.7,
      lng: -9.2,
      radiusKm: 10,
    }).expect(200);
    expect((response.body as SearchPage<'places'>).items).toEqual([
      expect.objectContaining({
        id: locations[0],
        rating: { average: 4.5, count: 2 },
      }),
    ]);
    const result = await get({
      q: 'Lisbon',
      type: 'posts',
      minRating: 4.5,
      lat: 38.7,
      lng: -9.2,
      radiusKm: 10,
    }).expect(200);
    expect(
      (result.body as SearchPage<'posts'>).items.map((item) => item.id).sort(),
    ).toEqual([posts[0], posts[1], posts[4]].sort());
    await get({ q: 'Lisbon', type: 'places', minRating: 5 }).expect(200, {
      items: [],
      nextCursor: null,
    });
  });
  it('continues from the sort key when the cursor row has been deleted', async () => {
    await prisma.user.createMany({
      data: [1, 2, 3].map((n) => ({
        id: `cursor-user-${n}`,
        email: `cursor${n}@example.com`,
        username: `cursor${n}`,
        firstName: 'Cursor',
        lastName: 'Fixture',
        createdAt: new Date('2026-01-01'),
      })),
    });
    const first = await service.page('search-viewer', 'people', {
      q: 'Cursor Fixture',
      limit: 1,
    });
    await prisma.user.delete({ where: { id: first.items[0].id } });
    const remaining = await service.page('search-viewer', 'people', {
      q: 'Cursor Fixture',
      cursor: first.nextCursor!,
    });
    expect(remaining.items).toHaveLength(2);
    expect(remaining.items.some((item) => item.id === first.items[0].id)).toBe(
      false,
    );
  });
});
