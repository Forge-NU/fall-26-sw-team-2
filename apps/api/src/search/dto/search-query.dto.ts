import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { SearchRequest, SearchSort, SearchType } from 'shared-types';

export class SearchQueryDto implements SearchRequest {
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q!: string;

  @IsOptional() @IsIn(['people', 'places', 'trips', 'posts']) type?: SearchType;
  @IsOptional() @IsIn(['relevance', 'newest']) sort?: SearchSort;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(40075)
  radiusKm?: number;
  @IsOptional() @IsString() @MaxLength(2048) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export function assertSearchQuery(query: SearchQueryDto): void {
  for (const value of [query.from, query.to]) {
    if (
      value &&
      (Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      throw new BadRequestException('Dates must be valid YYYY-MM-DD values');
    }
  }
  if (query.from && query.to && query.from > query.to)
    throw new BadRequestException('from must not be after to');
  if (
    (query.lat === undefined) !== (query.lng === undefined) ||
    (query.radiusKm !== undefined && query.lat === undefined)
  ) {
    throw new BadRequestException('Distance requires both lat and lng');
  }
  if (!query.type && query.cursor)
    throw new BadRequestException('cursor requires a result type');
}
