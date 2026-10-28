import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotContains,
} from 'class-validator';
import type { SearchType } from 'shared-types';
import { CharLength } from '../../common/char-length';
import { MAX_PAGE_SIZE } from '../../common/pagination';

export const SEARCH_TYPES: SearchType[] = ['people', 'places'];
export const MAX_QUERY_LENGTH = 100;

// Trimmed, with runs of whitespace collapsed, so "  maya   chen " and
// "maya chen" are the same search (and share cursors).
export function normalizeQuery(q: string | undefined): string {
  return (q ?? '').trim().replace(/\s+/g, ' ');
}

// A short or missing q isn't an error: the service returns an empty page, so
// the app can call this on every keystroke.
export class SearchQueryDto {
  @IsIn(SEARCH_TYPES)
  type: SearchType;

  // Normalized first, so the limit counts the query that's searched for
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeQuery(value) : value,
  )
  @IsString()
  @CharLength(0, MAX_QUERY_LENGTH)
  // Postgres text can't hold a NUL, so the query would fail with a 500
  @NotContains('\u0000', { message: 'q must not contain NUL characters' })
  q?: string;

  // Opaque, from a previous page's nextCursor (see search-cursor.ts)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}
