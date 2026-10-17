import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const READ_URL_EXPIRES_IN = 60 * 60; // 1 hour
const DELETE_BATCH_SIZE = 1000; // DeleteObjects limit

// Reads and deletes media in the S3 bucket. The bucket and the upload side
// come from INF-1 (#34) and MEDIA-1 (#38). Without S3_BUCKET_NAME (local dev),
// read URLs point at media.invalid and deletes are skipped.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env['S3_BUCKET_NAME'] || undefined;
  private readonly s3 = new S3Client({ region: process.env['AWS_REGION'] });

  async getReadUrl(key: string): Promise<string> {
    if (!this.bucket) {
      return `https://media.invalid/${key}`;
    }

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: READ_URL_EXPIRES_IN },
    );
  }

  // Never throws. Called after the rows are already deleted, so a failure here
  // only leaves orphaned objects behind, which are logged to clean up later.
  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    if (!this.bucket) {
      this.logger.warn(
        `S3_BUCKET_NAME not set, skipping delete of ${keys.length} objects`,
      );
      return;
    }

    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
      try {
        const result = await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        const failed = (result.Errors ?? []).map((e) => e.Key);
        if (failed.length > 0) {
          this.logger.error(
            `Failed to delete S3 objects: ${failed.join(', ')}`,
          );
        }
      } catch (e) {
        this.logger.error(
          `Failed to delete S3 objects: ${batch.join(', ')}`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }
  }
}
