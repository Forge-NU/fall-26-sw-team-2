import { Injectable } from '@nestjs/common';
import type {
  PersonSearchResult,
  PlaceSearchResult,
  SearchResponse,
} from 'shared-types';
import { DEFAULT_PAGE_SIZE } from '../common/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto, normalizeQuery } from './dto/search-query.dto';
import {
  PlaceCursor,
  SearchCursor,
  decodeSearchCursor,
  encodeSearchCursor,
} from './search-cursor';

// Contract: docs/architecture/search.md

// Shorter queries match almost everything, so they return nothing (DOC-1)
export const MIN_QUERY_LENGTH = 2;

const PEOPLE_COLUMNS = [
  Prisma.raw('u.username'),
  Prisma.raw('u.first_name'),
  Prisma.raw('u.last_name'),
];
const PLACE_COLUMNS = [
  Prisma.raw('l.name'),
  Prisma.raw('l.city'),
  Prisma.raw('l.region'),
];

type PersonRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_following: boolean;
  rank: number;
};

type PlaceRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country_code: string | null;
  post_count: number;
  rank: number;
};

// So a search for "100%" or "a_b" matches those characters literally
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

// The words that filter results. Shorter ones would match almost everything
// (DOC-1), so they only count toward ranking: "maya c" finds every Maya, with
// Maya Chen first. Counted in code points, so an emoji is one character.
export function filterWords(q: string): string[] {
  return [...new Set(q.split(' '))].filter(
    (word) => [...word].length >= MIN_QUERY_LENGTH,
  );
}

// Every word has to appear in at least one of the columns, so "maya chen"
// finds first name Maya, last name Chen. Each ILIKE can use that column's
// trigram index.
function allWordsMatch(words: string[], columns: Prisma.Sql[]): Prisma.Sql {
  return Prisma.join(
    words.map((word) => {
      const pattern = `%${escapeLike(word)}%`;
      return Prisma.sql`(${Prisma.join(
        columns.map((column) => Prisma.sql`${column} ILIKE ${pattern}`),
        ' OR ',
      )})`;
    }),
    ' AND ',
  );
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    viewerId: string,
    query: SearchQueryDto,
  ): Promise<SearchResponse> {
    const q = normalizeQuery(query.q);
    const words = filterWords(q);
    if (words.length === 0) {
      return { type: query.type, items: [], nextCursor: null };
    }

    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    if (query.type === 'people') {
      const after =
        query.cursor === undefined
          ? null
          : decodeSearchCursor(query.cursor, 'people', q);
      return {
        type: 'people',
        ...(await this.people(viewerId, q, words, after, limit)),
      };
    }
    const after =
      query.cursor === undefined
        ? null
        : decodeSearchCursor(query.cursor, 'places', q);
    return { type: 'places', ...(await this.places(q, words, after, limit)) };
  }

  // Ranked by a prefix match on any name first, then trigram similarity to
  // the whole query. Deleting an account deletes the row (DOC-1), so deleted
  // users are never matched.
  private async people(
    viewerId: string,
    q: string,
    words: string[],
    after: SearchCursor | null,
    limit: number,
  ) {
    const prefix = `${escapeLike(q)}%`;
    const rows = await this.prisma.$queryRaw<PersonRow[]>`
      WITH matches AS (
        SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url,
          ((CASE WHEN u.username ILIKE ${prefix}
              OR u.first_name ILIKE ${prefix}
              OR u.last_name ILIKE ${prefix}
              OR (u.first_name || ' ' || u.last_name) ILIKE ${prefix}
            THEN 1 ELSE 0 END)
            + similarity(u.username || ' ' || u.first_name || ' ' || u.last_name, ${q})
          )::float8 AS rank
        FROM "User" u
        WHERE ${allWordsMatch(words, PEOPLE_COLUMNS)}
      )
      SELECT m.*, EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = ${viewerId} AND f.following_id = m.id
      ) AS is_following
      FROM matches m
      ${after ? Prisma.sql`WHERE (m.rank, m.id) < (${after.rank}::float8, ${after.id})` : Prisma.empty}
      ORDER BY m.rank DESC, m.id DESC
      LIMIT ${limit + 1}
    `;

    return searchPage(rows, limit, toPersonResult, (last) =>
      encodeSearchCursor('people', q, { rank: last.rank, id: last.id }),
    );
  }

  // Locations with posts in published trips. The inner join means a place
  // tagged only in drafts is never returned, and draft posts aren't counted
  // (DOC-1). Custom pins (LOC-2) are never returned. Ranked by a prefix match
  // on the name, then similarity, then how many posts it has.
  private async places(
    q: string,
    words: string[],
    after: PlaceCursor | null,
    limit: number,
  ) {
    const prefix = `${escapeLike(q)}%`;
    const rows = await this.prisma.$queryRaw<PlaceRow[]>`
      WITH matches AS (
        SELECT l.id, l.name,
          l.latitude::float8 AS latitude, l.longitude::float8 AS longitude,
          l.city, l.region, l.country_code,
          count(*)::int AS post_count,
          ((CASE WHEN l.name ILIKE ${prefix} THEN 1 ELSE 0 END)
            + similarity(l.name, ${q}))::float8 AS rank
        FROM locations l
        JOIN posts p ON p.location_id = l.id
        JOIN trips t ON t.id = p.trip_id
        WHERE t.status = 'published'
          AND l.provider <> 'custom'
          AND ${allWordsMatch(words, PLACE_COLUMNS)}
        GROUP BY l.id
      )
      SELECT * FROM matches m
      ${
        after
          ? Prisma.sql`WHERE (m.rank, m.post_count, m.id)
              < (${after.rank}::float8, ${after.postCount}::int, ${after.id}::uuid)`
          : Prisma.empty
      }
      ORDER BY m.rank DESC, m.post_count DESC, m.id DESC
      LIMIT ${limit + 1}
    `;

    return searchPage(rows, limit, toPlaceResult, (last) =>
      encodeSearchCursor('places', q, {
        rank: last.rank,
        id: last.id,
        postCount: last.post_count,
      }),
    );
  }
}

// Rows are fetched with one extra to know if there's another page
function searchPage<Row, Item>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Item,
  cursorFor: (last: Row) => string,
): { items: Item[]; nextCursor: string | null } {
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(map),
    nextCursor: rows.length > limit && last ? cursorFor(last) : null,
  };
}

function toPersonResult(row: PersonRow): PersonSearchResult {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    isFollowing: row.is_following,
  };
}

function toPlaceResult(row: PlaceRow): PlaceSearchResult {
  return {
    id: row.id,
    name: row.name,
    coordinate: { latitude: row.latitude, longitude: row.longitude },
    city: row.city,
    region: row.region,
    countryCode: row.country_code,
    postCount: row.post_count,
    rating: null,
  };
}
