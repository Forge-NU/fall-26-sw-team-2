import { IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { CharLength } from '../../common/char-length';

export class CreateTripDto {
  @Trim()
  @IsString()
  @CharLength(1, 100)
  title: string;

  @Trim()
  @IsString()
  @CharLength(1, 100)
  destination: string;

  @IsOptional()
  @Trim()
  @IsString()
  @CharLength(0, 1000)
  description?: string | null;

  @Matches(DATE_ONLY, { message: 'startDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  startDate: string;

  @Matches(DATE_ONLY, { message: 'endDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  endDate: string;
}
