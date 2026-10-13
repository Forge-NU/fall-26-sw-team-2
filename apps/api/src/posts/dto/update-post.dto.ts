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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { MediaItemDto } from './media-item.dto';

// Every field is optional. Only caption can be cleared with null. Sending
// locationId or customLocationName replaces the other; `media` replaces the
// whole list.
export class UpdatePostDto {
  @ValidateIf((_, value) => value !== undefined)
  @Matches(DATE_ONLY, { message: 'visitedOn must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  visitedOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  locationId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @Length(1, 100)
  customLocationName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaItemDto)
  media?: MediaItemDto[];
}
