import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type {
  PersonSearchResult,
  PlaceSearchResult,
  SearchResponse,
} from 'shared-types';
import { Trip, User } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createTestUser } from './utils/test-app';

// Every fixture name contains a random tag, so searching for it only finds
// this run's rows and not other data in the dev database.
const tag = `sx${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const PAGED_COUNT = 45;

// People and places both have ids
const ids = (res: SearchResponse) =>
  (res.items as { id: string }[]).map((item) => item.id);

describe('Search (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let viewer: User;
  let alpha: User;
  let bravo: User;
  let charlie: User;
  const userIds: string[] = [];
  const locationIds: string[] = [];
  let towerId: string;
  let harborId: string;
  let draftOnlyId: string;
  let customId: string;

  const as = (user: User) => ({ 'x-test-user': user.id });
  const server = () => request(app.getHttpServer());

  async function makeUser(
    key: string,
    data: { username: string; firstName: string; lastName: string },
  ) {
    const user = await prisma.user.create({
      data: {
        id: `user_test_search_${key}_${randomUUID().slice(0, 8)}`,
        email: `${key}_${randomUUID().slice(0, 8)}@example.com`,
        ...data,
      },
    });
    userIds.push(user.id);
    return user;
  }

  async function makeTrip(owner: User, published: boolean) {
    return prisma.trip.create({
      data: {
        ownerId: owner.id,
        title: 'Search trip',
        destination: 'Southern Ocean',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-10'),
        ...(published ? { status: 'published', publishedAt: new Date() } : {}),
      },
    });
  }

  async function makeLocation(
    name: string,
    extra: { provider?: string; city?: string; region?: string } = {},
  ) {
    const location = await prisma.location.create({
      data: {
        provider: 'mapbox',
        providerPlaceId: `test.search.${randomUUID()}`,
        name,
        latitude: -60 - locationIds.length * 0.01,
        longitude: -100,
        countryCode: 'AQ',
        city: `Port ${tag}`,
        ...extra,
      },
    });
    locationIds.push(location.id);
    return location.id;
  }

  async function post(trip: Trip, locationId: string) {
    await prisma.post.create({
      data: { tripId: trip.id, locationId, visitedOn: new Date('2026-09-02') },
    });
  }

  async function search(query: Record<string, unknown>, user = viewer) {
    const res = await server()
      .get('/api/search')
      .query(query)
      .set(as(user))
      .expect(200);
    return res.body as SearchResponse;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    viewer = await createTestUser(prisma, 'searcher');
    userIds.push(viewer.id);

    // Each matches the tag on a different column
    alpha = await makeUser('alpha', {
      username: `${tag}_alpha`,
      firstName: 'Alpha',
      lastName: 'One',
    });
    bravo = await makeUser('bravo', {
      username: `bravo_${randomUUID().slice(0, 8)}`,
      firstName: `${tag}bravo`,
      lastName: 'Two',
    });
    charlie = await makeUser('charlie', {
      username: `charlie_${randomUUID().slice(0, 8)}`,
      firstName: 'Charlie',
      lastName: `${tag}charlie`,
    });
    await prisma.follow.create({
      data: { followerId: viewer.id, followingId: alpha.id },
    });

    // Lots of matches, to page through
    const paged = Array.from({ length: PAGED_COUNT }, (_, i) => ({
      id: `user_test_search_paged_${i}_${randomUUID().slice(0, 8)}`,
      email: `paged_${i}_${randomUUID().slice(0, 8)}@example.com`,
      username: `${tag}page${String(i).padStart(2, '0')}`,
      firstName: 'Paged',
      lastName: `User ${i}`,
    }));
    await prisma.user.createMany({ data: paged });
    userIds.push(...paged.map((u) => u.id));

    const published = await makeTrip(alpha, true);
    const draft = await makeTrip(alpha, false);

    // 2 published posts and 1 draft post
    towerId = await makeLocation(`${tag} Tower`);
    await post(published, towerId);
    await post(published, towerId);
    await post(draft, towerId);

    // Matches on city and region, not name
    harborId = await makeLocation('Harbor', {
      city: `${tag}ville`,
      region: `${tag} Region`,
    });
    await post(published, harborId);

    // Only tagged in a draft
    draftOnlyId = await makeLocation(`${tag} Draft Cafe`);
    await post(draft, draftOnlyId);

    // A custom pin (LOC-2) with a published post
    customId = await makeLocation(`${tag} Pin`, { provider: 'custom' });
    await post(published, customId);
  });

  afterAll(async () => {
    // Cascades to trips, posts and follows
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.location.deleteMany({ where: { id: { in: locationIds } } });
    await app.close();
  });

  describe('people', () => {
    it('matches username, first name and last name', async () => {
      expect(ids(await search({ type: 'people', q: `${tag}_alp` }))).toEqual([
        alpha.id,
      ]);
      expect(ids(await search({ type: 'people', q: `${tag}bravo` }))).toEqual([
        bravo.id,
      ]);
      expect(ids(await search({ type: 'people', q: `${tag}CHARLIE` }))).toEqual(
        [charlie.id],
      );
    });

    it('matches "first last" across both columns', async () => {
      expect(
        ids(await search({ type: 'people', q: `${tag}bravo  two` })),
      ).toEqual([bravo.id]);
      expect(
        ids(await search({ type: 'people', q: `${tag}bravo one` })),
      ).toEqual([]);
    });

    it('says whether the viewer follows each person', async () => {
      const res = await search({ type: 'people', q: `${tag}_alpha` });
      expect(res).toEqual({
        type: 'people',
        nextCursor: null,
        items: [
          {
            id: alpha.id,
            username: alpha.username,
            firstName: 'Alpha',
            lastName: 'One',
            avatarUrl: null,
            isFollowing: true,
          },
        ],
      });

      const other = (await search({ type: 'people', q: `${tag}bravo` }))
        .items[0] as PersonSearchResult;
      expect(other.isFollowing).toBe(false);
    });

    it('never returns a deleted account', async () => {
      const gone = await makeUser('gone', {
        username: `${tag}_gone`,
        firstName: 'Gone',
        lastName: 'User',
      });
      expect(ids(await search({ type: 'people', q: `${tag}_gone` }))).toEqual([
        gone.id,
      ]);

      await prisma.user.delete({ where: { id: gone.id } });
      expect(ids(await search({ type: 'people', q: `${tag}_gone` }))).toEqual(
        [],
      );
    });

    it('pages through every match once, in rank order', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const res: SearchResponse = await search({
          type: 'people',
          q: `${tag}page`,
          limit: 20,
          ...(cursor ? { cursor } : {}),
        });
        seen.push(...ids(res));
        cursor = res.nextCursor;
        pages++;
      } while (cursor);

      expect(pages).toBe(3);
      expect(seen).toHaveLength(PAGED_COUNT);
      expect(new Set(seen).size).toBe(PAGED_COUNT);
    });
  });

  describe('places', () => {
    it('returns places with published posts, with what the map needs', async () => {
      const res = await search({ type: 'places', q: tag });
      expect(res.type).toBe('places');
      const items = res.items as PlaceSearchResult[];

      // The name prefix match ranks first
      expect(items.map((p) => p.id)).toEqual([towerId, harborId]);
      expect(items[0]).toEqual({
        id: towerId,
        name: `${tag} Tower`,
        coordinate: { latitude: -60, longitude: -100 },
        city: `Port ${tag}`,
        region: null,
        countryCode: 'AQ',
        postCount: 2,
        rating: null,
      });
    });

    it('matches city and region', async () => {
      const byCity = await search({ type: 'places', q: `${tag}ville` });
      expect(ids(byCity)).toEqual([harborId]);

      const byRegion = await search({ type: 'places', q: `${tag} region` });
      expect(ids(byRegion)).toEqual([harborId]);
    });

    it('never returns a place only tagged in drafts, or a custom pin', async () => {
      const draftOnly = await search({ type: 'places', q: `${tag} draft` });
      expect(draftOnly.items).toEqual([]);

      const custom = await search({ type: 'places', q: `${tag} pin` });
      expect(custom.items).toEqual([]);

      const all = await search({ type: 'places', q: tag });
      expect(ids(all)).not.toEqual(expect.arrayContaining([draftOnlyId]));
      expect(ids(all)).not.toEqual(expect.arrayContaining([customId]));
    });

    it('pages with a cursor', async () => {
      const first = await search({ type: 'places', q: tag, limit: 1 });
      expect(ids(first)).toEqual([towerId]);
      expect(first.nextCursor).toEqual(expect.any(String));

      const second = await search({
        type: 'places',
        q: tag,
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(ids(second)).toEqual([harborId]);
      expect(second.nextCursor).toBeNull();
    });
  });

  describe('validation', () => {
    it('returns an empty page for queries under 2 characters', async () => {
      for (const q of [undefined, '', 'a', '   s  ', 'a e']) {
        await expect(
          search({ type: 'places', ...(q === undefined ? {} : { q }) }),
        ).resolves.toEqual({ type: 'places', items: [], nextCursor: null });
      }
      await expect(search({ type: 'people', q: 's' })).resolves.toEqual({
        type: 'people',
        items: [],
        nextCursor: null,
      });
    });

    it('rejects a bad type, query, limit or cursor', async () => {
      const bad = (query: Record<string, unknown>) =>
        server().get('/api/search').query(query).set(as(viewer)).expect(400);

      await bad({ q: tag });
      await bad({ type: 'trips', q: tag });
      await bad({ type: 'people', q: 'x'.repeat(101) });
      await bad({ type: 'people', q: 'ab\u0000cd' });
      await bad({ type: 'people', q: tag, limit: 51 });
      await bad({ type: 'people', q: tag, cursor: 'not-a-cursor' });

      // A cursor from a different search
      const first = await search({ type: 'people', q: `${tag}page`, limit: 1 });
      await bad({ type: 'people', q: `${tag}pag`, cursor: first.nextCursor });
      await bad({ type: 'places', q: `${tag}page`, cursor: first.nextCursor });
    });

    it('counts the 100-character limit after trimming', async () => {
      await expect(
        search({ type: 'people', q: ' '.repeat(5) + 'x'.repeat(96) }),
      ).resolves.toEqual({ type: 'people', items: [], nextCursor: null });
    });

    it('needs a signed-in user', async () => {
      await server()
        .get('/api/search')
        .query({ type: 'people', q: tag })
        .expect(401);
    });
  });
});
