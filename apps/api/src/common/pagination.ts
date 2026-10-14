import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Cursor pagination for list endpoints. Stand-in until API-1 (#28) adds the
// shared helper; the request and response shapes match what it'll use.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export class PaginationQueryDto {
  // Any UUID Postgres accepts, not just RFC 4122 ones
  @IsOptional()
  @IsUUID('all')
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

// The cursor has to be a row in the list being paged (matching its filter).
// Prisma doesn't check this: an unknown or deleted cursor silently returns an
// empty page, and one from another list starts from the wrong position.
export async function assertCursorInList(
  query: PaginationQueryDto,
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
export function pageArgs(query: PaginationQueryDto) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  return {
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

export async function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  query: PaginationQueryDto,
  map: (row: Row) => Item | Promise<Item>,
): Promise<Page<Item>> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: await Promise.all(pageRows.map(map)),
    nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
  };
}
