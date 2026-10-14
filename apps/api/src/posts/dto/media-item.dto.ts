import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
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
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;

  // Videos are up to 60 seconds (DOC-1)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60000)
  durationMs?: number;
}
