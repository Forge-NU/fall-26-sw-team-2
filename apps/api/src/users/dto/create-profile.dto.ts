import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may contain only letters, numbers, and underscores',
  })
  username!: string;
}
