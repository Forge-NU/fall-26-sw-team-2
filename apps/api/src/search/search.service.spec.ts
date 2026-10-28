import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeQuery } from './dto/search-query.dto';
import { decodeSearchCursor, encodeSearchCursor } from './search-cursor';
import { SearchService, escapeLike } from './search.service';

describe('SearchService', () => {
  const prisma = { $queryRaw: jest.fn() };
  const service = new SearchService(prisma as unknown as PrismaService);
  const viewerId = 'user_viewer';
  const placeId = '00000000-0000-4000-a000-000000000001';

  const personRow = (id: string, rank = 1.5) => ({
    id,
    username: `user_${id}`,
    first_name: 'Maya',
    last_name: 'Chen',
    avatar_url: null,
    is_following: id === 'a',
    rank,
  });

  const placeRow = (id = placeId, rank = 1.2) => ({
    id,
    name: 'Belém Tower',
    latitude: 38.691584,
    longitude: -9.215977,
    city: 'Lisbon',
    region: 'Lisbon',
    country_code: 'PT',
    post_count: 3,
    rank,
  });

  // The query as Postgres gets it, with nested fragments flattened
  function lastQuery() {
    const [strings, ...values] = prisma.$queryRaw.mock.calls.at(-1) as [
      string[],
      ...unknown[],
    ];
    return Prisma.sql(strings, ...values);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([]);
  });

  describe('normalizeQuery and escapeLike', () => {
    it('trims and collapses whitespace', () => {
      expect(normalizeQuery('  maya   chen ')).toBe('maya chen');
      expect(normalizeQuery(undefined)).toBe('');
    });

    it('escapes LIKE wildcards', () => {
      expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    });
  });

  describe('short queries', () => {
    it.each([undefined, '', 'a', '  a  ', '🌍', 'a e', 'a 🌍 b'])(
      'returns an empty page for %p without querying',
      async (q) => {
        await expect(
          service.search(viewerId, { type: 'people', q }),
        ).resolves.toEqual({ type: 'people', items: [], nextCursor: null });
        await expect(
          service.search(viewerId, { type: 'places', q }),
        ).resolves.toEqual({ type: 'places', items: [], nextCursor: null });
        expect(prisma.$queryRaw).not.toHaveBeenCalled();
      },
    );
  });

  describe('people', () => {
    it('maps rows and says whether the viewer follows them', async () => {
      prisma.$queryRaw.mockResolvedValue([personRow('a'), personRow('b')]);

      const res = await service.search(viewerId, { type: 'people', q: 'ma' });

      expect(res).toEqual({
        type: 'people',
        nextCursor: null,
        items: [
          {
            id: 'a',
            username: 'user_a',
            firstName: 'Maya',
            lastName: 'Chen',
            avatarUrl: null,
            isFollowing: true,
          },
          expect.objectContaining({ id: 'b', isFollowing: false }),
        ],
      });
      const query = lastQuery();
      expect(query.sql).toContain('FROM "User" u');
      expect(query.values).toContain(viewerId);
    });

    it('needs every word to match a name column, with wildcards escaped', async () => {
      await service.search(viewerId, { type: 'people', q: ' maya  c_n ' });

      const { sql, values } = lastQuery();
      expect(sql.match(/ ILIKE /g)).toHaveLength(4 + 3 * 2);
      expect(values).toEqual(
        expect.arrayContaining(['%maya%', '%c\\_n%', 'maya c\\_n%']),
      );
    });

    it('ranks by one-letter words but does not filter by them', async () => {
      await service.search(viewerId, { type: 'people', q: 'maya c' });

      const { sql, values } = lastQuery();
      expect(sql.match(/ ILIKE /g)).toHaveLength(4 + 3);
      expect(values).toEqual(expect.arrayContaining(['%maya%', 'maya c%']));
      expect(values).not.toContain('%c%');
    });

    it('returns a cursor for the next page when there is one', async () => {
      prisma.$queryRaw.mockResolvedValue([
        personRow('c', 1.9),
        personRow('b', 1.4),
        personRow('a', 1.1),
      ]);

      const res = await service.search(viewerId, {
        type: 'people',
        q: 'maya',
        limit: 2,
      });

      expect((res.items as { id: string }[]).map((i) => i.id)).toEqual([
        'c',
        'b',
      ]);
      expect(lastQuery().values).toContain(3);
      expect(decodeSearchCursor(res.nextCursor!, 'people', 'maya')).toEqual({
        rank: 1.4,
        id: 'b',
      });
    });

    it('continues after the cursor', async () => {
      const cursor = encodeSearchCursor('people', 'maya', {
        rank: 1.4,
        id: 'b',
      });

      await service.search(viewerId, { type: 'people', q: 'maya', cursor });

      const { sql, values } = lastQuery();
      expect(sql).toContain('(m.rank, m.id) <');
      expect(values).toEqual(expect.arrayContaining([1.4, 'b']));
    });

    it('rejects a cursor from a different search', async () => {
      const cursor = encodeSearchCursor('people', 'maya', {
        rank: 1,
        id: 'b',
      });

      await expect(
        service.search(viewerId, { type: 'people', q: 'mayo', cursor }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.search(viewerId, { type: 'places', q: 'maya', cursor }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects a cursor whose id has a NUL character', async () => {
      const cursor = encodeSearchCursor('people', 'maya', {
        rank: 1,
        id: 'user_\u0000b',
      });

      await expect(
        service.search(viewerId, { type: 'people', q: 'maya', cursor }),
      ).rejects.toThrow('Invalid cursor');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('places', () => {
    it('maps rows into what the map needs', async () => {
      prisma.$queryRaw.mockResolvedValue([placeRow()]);

      const res = await service.search(viewerId, {
        type: 'places',
        q: 'belem',
      });

      expect(res).toEqual({
        type: 'places',
        nextCursor: null,
        items: [
          {
            id: placeId,
            name: 'Belém Tower',
            coordinate: { latitude: 38.691584, longitude: -9.215977 },
            city: 'Lisbon',
            region: 'Lisbon',
            countryCode: 'PT',
            postCount: 3,
            rating: null,
          },
        ],
      });
    });

    it('only counts published trips and skips custom pins', async () => {
      await service.search(viewerId, { type: 'places', q: 'lisbon' });

      const { sql } = lastQuery();
      expect(sql).toContain("t.status = 'published'");
      expect(sql).toContain("l.provider <> 'custom'");
      expect(sql).toContain('JOIN posts p ON p.location_id = l.id');
    });

    it('pages by rank, then post count, then id', async () => {
      prisma.$queryRaw.mockResolvedValue([placeRow(), placeRow()]);

      const res = await service.search(viewerId, {
        type: 'places',
        q: 'belem',
        limit: 1,
      });
      expect(decodeSearchCursor(res.nextCursor!, 'places', 'belem')).toEqual({
        rank: 1.2,
        id: placeId,
        postCount: 3,
      });

      await service.search(viewerId, {
        type: 'places',
        q: 'belem',
        cursor: res.nextCursor!,
      });
      expect(lastQuery().sql).toContain('(m.rank, m.post_count, m.id)');
    });

    it('rejects a place cursor whose id is not a uuid', async () => {
      const cursor = encodeSearchCursor('places', 'belem', {
        rank: 1,
        id: "x'; DROP TABLE locations; --",
        postCount: 1,
      });

      await expect(
        service.search(viewerId, { type: 'places', q: 'belem', cursor }),
      ).rejects.toThrow('Invalid cursor');
    });
  });

  it('rejects a cursor that is not ours', async () => {
    await expect(
      service.search(viewerId, { type: 'people', q: 'maya', cursor: 'nope' }),
    ).rejects.toThrow('Invalid cursor');
  });
});
