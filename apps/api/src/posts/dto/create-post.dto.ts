import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { MediaItemDto } from './media-item.dto';

// Exactly one of locationId and customLocationName is required; the service
// checks that, since it depends on both fields.
export class CreatePostDto {
  @IsUUID()
  tripId: string;

  @Matches(DATE_ONLY, { message: 'visitedOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  visitedOn: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100)
  customLocationName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media: MediaItemDto[];
}
