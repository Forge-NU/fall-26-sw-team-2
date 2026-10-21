import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { CharLength } from '../../common/char-length';

// Every field is optional. Only description can be cleared with null; the
// rest reject null.
export class UpdateTripDto {
  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @CharLength(1, 100)
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Trim()
  @IsString()
  @CharLength(1, 100)
  destination?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @CharLength(0, 1000)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @Matches(DATE_ONLY, { message: 'startDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Matches(DATE_ONLY, { message: 'endDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate?: string;
}
