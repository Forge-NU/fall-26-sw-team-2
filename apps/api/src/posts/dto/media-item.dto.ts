import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class MediaItemDto {
  // From the upload endpoint (#38), e.g. users/{userId}/posts/{uuid}.jpg
  @IsString()
  @MaxLength(512)
  s3Key: string;

  @IsIn(['image', 'video'])
  mediaType: 'image' | 'video';

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}
