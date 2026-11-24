import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/trim';

// Body of POST /api/trips/:id/invites (CreateTripInviteRequest)
export class CreateTripInviteDto {
  // Same rules as a username itself (see UsernameAvailabilityDto). Usernames
  // are stored lowercase, so the service lowercases it before looking it up.
  @Trim()
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may contain only letters, numbers, and underscores',
  })
  username!: string;
}
