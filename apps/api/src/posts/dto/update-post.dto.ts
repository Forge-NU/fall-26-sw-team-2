import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { CharLength } from '../../common/char-length';
import { MediaItemDto } from './media-item.dto';

// Every field is optional. Only caption and rating can be cleared with null.
// Sending locationId or customLocationName replaces the other, and switching
// to a customLocationName clears the rating (custom locations can't be rated).
// `media` replaces the whole list.
export class UpdatePostDto {
  @ValidateIf((_, value) => value !== undefined)
  @Matches(DATE_ONLY, { message: 'visitedOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  visitedOn?: string;

  @IsOptional()
  @IsString()
  @CharLength(0, 2200)
  caption?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('all')
  locationId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @CharLength(1, 100)
  customLocationName?: string;

  // 1-5 stars for the place; null clears it
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];
}
