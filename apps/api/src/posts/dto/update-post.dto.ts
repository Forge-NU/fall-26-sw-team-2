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

// Every field is optional. Caption and rating can be cleared with null.
// Sending locationId or customLocationName replaces the other, and sending
// both as null removes the location (#143 POST-4). Switching to a
// customLocationName or to no location clears the rating, since neither can
// be rated. The service checks the location combinations, since they depend
// on both fields. `media` replaces the whole list.
export class UpdatePostDto {
  @ValidateIf((_, value) => value !== undefined)
  @Matches(DATE_ONLY, { message: 'visitedOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  visitedOn?: string;

  @IsOptional()
  @IsString()
  @CharLength(0, 2200)
  caption?: string | null;

  @IsOptional()
  @IsUUID('all')
  locationId?: string | null;

  @IsOptional()
  @Trim()
  @IsString()
  @CharLength(1, 100)
  customLocationName?: string | null;

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
