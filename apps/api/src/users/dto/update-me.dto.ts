import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  // The s3Key from POST /api/media/uploads (purpose "avatar"), or null to
  // remove the avatar. Has to be one of your own avatar uploads.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  avatarKey?: string | null;
}
