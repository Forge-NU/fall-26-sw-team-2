import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateMeDto {
  // Same limits as onboarding (CreateProfileDto). A first name can't be blank;
  // a last name can be cleared.
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'firstName must not be blank' })
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  // Matches what Clerk accepts, since usernames are copied to Clerk for
  // sign-in (Clerk requires 4+ characters and rejects periods).
  @MinLength(4)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may contain only letters, numbers, and underscores',
  })
  username?: string;

  // The s3Key from POST /api/media/uploads (purpose "avatar"), or null to
  // remove the avatar. Has to be one of your own avatar uploads.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  avatarKey?: string | null;
}
