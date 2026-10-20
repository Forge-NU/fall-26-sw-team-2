import { IsIn, IsInt, Max, Min } from 'class-validator';
import type { UploadContentType, UploadPurpose } from 'shared-types';
import {
  MAX_PHOTO_BYTES,
  UPLOAD_CONTENT_TYPES,
  UPLOAD_PURPOSES,
} from '../media-limits';

export class CreateUploadDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  @IsIn(UPLOAD_CONTENT_TYPES)
  contentType: UploadContentType;

  // Size in bytes of the file the app will upload. It's signed into the URL,
  // so S3 rejects an upload of any other size.
  @IsInt()
  @Min(1)
  @Max(MAX_PHOTO_BYTES)
  fileSize: number;
}
