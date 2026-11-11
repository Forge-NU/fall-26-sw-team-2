import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PaginatedResponse } from 'shared-types';

// Cursor pagination for every list endpoint (API-2, #90). See "Cursor-Based
// Pagination" in docs/architecture/api-conventions.md.
//
// A cursor is opaque to clients: base64url JSON holding the list it belongs to
// and the sort key of the last row on the page, ending with the row's id. The
// next page starts after that key (a keyset), so it works for any
// `ORDER BY sortKey…, id` and keeps working if the last row is deleted.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

export function pageLimit(query: PaginationQueryDto): number {
  return query.limit ?? DEFAULT_PAGE_SIZE;
}

export type CursorValue = string | number | Date;
export type CursorValueType = 'string' | 'number' | 'date';

type CursorPayload = { list: string; key: unknown[] };

// `list` names the list the cursor pages through, including whatever it's
// filtered by (e.g. `trips:${userId}`), so a cursor from one list is rejected
// on another instead of starting from a meaningless position.
export function encodeCursor(list: string, key: CursorValue[]): string {
  const payload: CursorPayload = {
    list,
    key: key.map((value) =>
      value instanceof Date ? value.toISOString() : value,
    ),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

// The sort key in `cursor`, or undefined for the first page. Throws a 400 if
// the cursor is malformed, from another list, or doesn't match `types`.
export function decodeCursor(
  cursor: string | undefined,
  list: string,
  types: readonly CursorValueType[],
): CursorValue[] | undefined {
  if (cursor === undefined) return undefined;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    (payload as CursorPayload).list !== list ||
    !Array.isArray((payload as CursorPayload).key) ||
    (payload as CursorPayload).key.length !== types.length
  ) {
    throw invalidCursor();
  }
  return (payload as CursorPayload).key.map((value, i) =>
    parseValue(value, types[i]),
  );
}

function parseValue(value: unknown, type: CursorValueType): CursorValue {
  if (type === 'string' && typeof value === 'string' && value) return value;
  if (type === 'number' && typeof value === 'number' && isFinite(value)) {
    return value;
  }
  if (type === 'date' && typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw invalidCursor();
}

function invalidCursor() {
  return new BadRequestException('Invalid cursor');
}

// `rows` is a query fetched with `take: limit + 1`: the extra row only says
// there's another page. The cursor comes from the last row that's returned.
export function buildPage<Row>(
  rows: Row[],
  limit: number,
  toCursor: (row: Row) => string,
): PaginatedResponse<Row> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? toCursor(items[items.length - 1]) : null,
  };
}

export type KeysetField<Row> = {
  field: keyof Row & string;
  direction: 'asc' | 'desc';
  type: CursorValueType;
};

// The order, keyset filter and cursors for a Prisma list, from one list of
// sort fields. The last field has to be unique (normally `id`) so the order is
// total, and none of them can be nullable. `Where` and `OrderBy` are the
// model's Prisma input types, e.g. Prisma.TripWhereInput.
export function keyset<Row, Where, OrderBy>(
  fields: readonly KeysetField<Row>[],
) {
  const types = fields.map((f) => f.type);
  return {
    orderBy: fields.map((f) => ({ [f.field]: f.direction })) as OrderBy[],

    // Rows after `key` in this order: (a > A) OR (a = A AND b > B) OR …,
    // with < for descending fields. Matches all rows for the first page.
    after(key: CursorValue[] | undefined): Where {
      if (!key) return {} as Where;
      return {
        OR: fields.map((f, i) => ({
          ...Object.fromEntries(
            fields.slice(0, i).map((prev, j) => [prev.field, key[j]]),
          ),
          [f.field]: { [f.direction === 'asc' ? 'gt' : 'lt']: key[i] },
        })),
      } as Where;
    },

    decode(cursor: string | undefined, list: string) {
      return decodeCursor(cursor, list, types);
    },

    cursor(list: string, row: Row): string {
      return encodeCursor(
        list,
        fields.map((f) => row[f.field] as CursorValue),
      );
    },
  };
}
