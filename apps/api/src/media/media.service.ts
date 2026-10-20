import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { CreateUploadResponse } from 'shared-types';
import { StorageService } from '../storage/storage.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UPLOAD_FOLDERS } from './media-limits';

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  // Keys are users/{userId}/{posts|stories|avatars}/{uuid}.jpg, so the post
  // and story endpoints can tell whose upload a key is from the key alone.
  async createUpload(
    userId: string,
    dto: CreateUploadDto,
  ): Promise<CreateUploadResponse> {
    const s3Key = `users/${userId}/${UPLOAD_FOLDERS[dto.purpose]}/${randomUUID()}.jpg`;
    const { url, expiresAt } = await this.storage.getUploadUrl(
      s3Key,
      dto.contentType,
      dto.fileSize,
    );
    return { s3Key, uploadUrl: url, expiresAt: expiresAt.toISOString() };
  }
}
