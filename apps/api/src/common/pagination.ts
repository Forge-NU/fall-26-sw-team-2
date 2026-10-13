import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Cursor pagination for list endpoints. Stand-in until API-1 (#28) adds the
// shared helper; the request and response shapes match what it'll use.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export class PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
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
