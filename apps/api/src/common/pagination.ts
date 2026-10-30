import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Cursor pagination for list endpoints. Stand-in until API-1 (#28) adds the
// shared helper; the request and response shapes match what it'll use.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// The cursor and limit the helpers below read. Lists whose cursor isn't a
// UUID (e.g. a user ID) extend PageLimitDto with their own cursor rule.
export type PageQuery = { cursor?: string; limit?: number };

export class PageLimitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

export class PaginationQueryDto extends PageLimitDto {
  // Any UUID Postgres accepts, not just RFC 4122 ones
  @IsOptional()
  @IsUUID('all')
  cursor?: string;
}

// The cursor has to be a row in the list being paged (matching its filter).
// Prisma doesn't check this: an unknown or deleted cursor silently returns an
// empty page, and one from another list starts from the wrong position.
export async function assertCursorInList(
  query: PageQuery,
  findInList: (cursor: string) => Promise<unknown>,
) {
  if (query.cursor && !(await findInList(query.cursor))) {
    throw new BadRequestException('Invalid cursor');
  }
}

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// Prisma args for one page. Fetches one extra row to know if there's another
// page. The query's orderBy has to end with `id` so the order is stable.
export function pageArgs(query: PageQuery) {
  return keyedPageArgs(query, (id) => ({ id }));
}

// pageArgs for a table without an `id`, like a join table keyed by
// (user_id, post_id). `toKey` turns the cursor into the row's unique key, and
// the orderBy has to end with that key's columns.
export function keyedPageArgs<Key>(
  query: PageQuery,
  toKey: (cursor: string) => Key,
) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  return {
    take: limit + 1,
    ...(query.cursor ? { cursor: toKey(query.cursor), skip: 1 } : {}),
  };
}

// `cursorOf` is the value the next request sends back as `cursor`. It
// defaults to the row's `id`; keyedPageArgs lists pass the part of the key
// that isn't fixed by the list (e.g. the post ID in one user's saves).
export function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  query: PageQuery,
  map: (row: Row) => Item | Promise<Item>,
): Promise<Page<Item>>;
export function toPage<Row, Item>(
  rows: Row[],
  query: PageQuery,
  map: (row: Row) => Item | Promise<Item>,
  cursorOf: (row: Row) => string,
): Promise<Page<Item>>;
export async function toPage<Row, Item>(
  rows: Row[],
  query: PageQuery,
  map: (row: Row) => Item | Promise<Item>,
  cursorOf: (row: Row) => string = (row) => (row as { id: string }).id,
): Promise<Page<Item>> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: await Promise.all(pageRows.map(map)),
    nextCursor: hasMore ? cursorOf(pageRows[pageRows.length - 1]) : null,
  };
}
