import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { DATE_ONLY } from '../../common/dates';

export class ActiveTripsQueryDto {
  // The user's local date
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date?: string;
}
