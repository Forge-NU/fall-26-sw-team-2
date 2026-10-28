import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { SearchType } from 'shared-types';

// Results are ordered by relevance, so the cursor is the last row's sort key
// rather than just its id (common/pagination.ts pages by id). It's bound to
// the search it came from, like the follow-list cursor, so it can't be
// replayed against a different query. Swaps to API-2 (#90) once that lands.

export type SearchCursor = {
  rank: number;
  id: string;
};

// Places are ordered by rank, then post count
export type PlaceCursor = SearchCursor & { postCount: number };

type Payload = SearchCursor & {
  type: SearchType;
  q: string;
  postCount?: number;
};

export function encodeSearchCursor(
  type: 'people',
  q: string,
  at: SearchCursor,
): string;
export function encodeSearchCursor(
  type: 'places',
  q: string,
  at: PlaceCursor,
): string;
export function encodeSearchCursor(
  type: SearchType,
  q: string,
  at: SearchCursor | PlaceCursor,
): string {
  const payload: Payload = { type, q, ...at };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeSearchCursor(
  cursor: string,
  type: 'people',
  q: string,
): SearchCursor;
export function decodeSearchCursor(
  cursor: string,
  type: 'places',
  q: string,
): PlaceCursor;
export function decodeSearchCursor(
  cursor: string,
  type: SearchType,
  q: string,
): SearchCursor | PlaceCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<Payload> | null;
    if (
      !decoded ||
      decoded.type !== type ||
      decoded.q !== q ||
      typeof decoded.rank !== 'number' ||
      !Number.isFinite(decoded.rank) ||
      typeof decoded.id !== 'string' ||
      !decoded.id ||
      // Postgres text can't hold a NUL, so it would be a 500
      decoded.id.includes('\u0000')
    ) {
      throw new Error('Invalid cursor');
    }
    if (type === 'people') {
      return { rank: decoded.rank, id: decoded.id };
    }
    // Places compare the id as a uuid, so anything else would be a 500
    if (
      !isUUID(decoded.id, 'all') ||
      typeof decoded.postCount !== 'number' ||
      !Number.isInteger(decoded.postCount)
    ) {
      throw new Error('Invalid cursor');
    }
    return {
      rank: decoded.rank,
      id: decoded.id,
      postCount: decoded.postCount,
    };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}
