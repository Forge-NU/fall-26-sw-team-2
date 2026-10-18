import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_ONLY } from '../../common/dates';
import { Trim } from '../../common/trim';
import { CharLength } from '../../common/char-length';

// At most one of locationId and customLocationName, and keepOnTrip only with
// a tripId; the service checks those, since they depend on two fields.
export class CreateStoryDto {
  // From the upload endpoint (#38), e.g. users/{userId}/stories/{uuid}.jpg
  @IsString()
  @MaxLength(512)
  s3Key: string;

  // Has to be one of the user's active trips
  @IsOptional()
  @IsUUID('all')
  tripId?: string;

  // "Add to trip": keep the story on the trip page after it expires
  @IsOptional()
  @IsBoolean()
  keepOnTrip?: boolean;

  @IsOptional()
  @IsString()
  @CharLength(0, 200)
  text?: string | null;

  @IsOptional()
  @IsUUID('all')
  locationId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @CharLength(1, 100)
  customLocationName?: string;

  // The user's local date, for checking the trip is active
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  date?: string;

  // The day the story is from, e.g. when the photo was taken. Defaults to
  // today. With a trip: within its dates and not in the future. Without a
  // trip: today only.
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'storyDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  storyDate?: string;
}
