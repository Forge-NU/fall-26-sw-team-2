import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PaginatedResponse } from 'shared-types';

// Isolated adapter until #90 supplies the common scoped keyset API.
export interface SearchCursor {
  scope: string;
  key: string;
  id: string;
}
export function searchScope(values: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}
export function decodeSearchCursor(value: string, scope: string): SearchCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 2048)
      throw new Error();
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object') throw new Error();
    const cursor = parsed as SearchCursor;
    if (
      cursor.scope !== scope ||
      typeof cursor.key !== 'string' ||
      !/^-?\d{1,20}(\.\d{1,6})?$/.test(cursor.key) ||
      typeof cursor.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,256}$/.test(cursor.id)
    )
      throw new Error();
    return cursor;
  } catch {
    throw new BadRequestException('Invalid search cursor');
  }
}
export function buildSearchPage<Row, Item>(
  rows: Row[],
  limit: number,
  items: Item[],
  cursor: (row: Row) => SearchCursor,
): PaginatedResponse<Item> {
  return {
    items,
    nextCursor:
      rows.length > limit ? encodeSearchCursor(cursor(rows[limit - 1])) : null,
  };
}
