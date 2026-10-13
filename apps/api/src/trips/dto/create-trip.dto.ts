import {
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';

export class CreateTripDto {
  @Trim()
  @IsString()
  @Length(1, 100)
  title: string;

  @Trim()
  @IsString()
  @Length(1, 100)
  destination: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Matches(DATE_ONLY, { message: 'startDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate: string;

  @Matches(DATE_ONLY, { message: 'endDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate: string;
}
