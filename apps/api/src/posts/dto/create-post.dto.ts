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
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { CharLength } from '../../common/char-length';
import { MediaItemDto } from './media-item.dto';

// Exactly one of locationId and customLocationName is required, and a rating
// only goes with a locationId; the service checks both, since they depend on
// more than one field.
export class CreatePostDto {
  @IsUUID('all')
  tripId: string;

  @Matches(DATE_ONLY, { message: 'visitedOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  visitedOn: string;

  @IsOptional()
  @IsString()
  @CharLength(0, 2200)
  caption?: string | null;

  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @CharLength(1, 100)
  customLocationName?: string;

  // 1-5 stars for the place
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media: MediaItemDto[];
}
