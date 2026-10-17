import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
