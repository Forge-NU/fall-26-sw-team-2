import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UsernameAvailabilityDto {
  @IsString()
  // Matches what Clerk accepts, since usernames are copied to Clerk for
  // sign-in (Clerk requires 4+ characters and rejects periods).
  @MinLength(4)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may contain only letters, numbers, and underscores',
  })
  username!: string;
}
