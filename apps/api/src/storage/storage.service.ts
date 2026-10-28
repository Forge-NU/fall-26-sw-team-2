import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const READ_URL_EXPIRES_IN = 60 * 60; // 1 hour
const UPLOAD_URL_EXPIRES_IN = 15 * 60; // 15 minutes
const DELETE_BATCH_SIZE = 1000; // DeleteObjects limit

// Uploads, reads and deletes media in the S3 bucket. The bucket comes from
// INF-1 (#34). Without S3_BUCKET_NAME (local dev), upload and read URLs point
// at media.invalid and deletes are skipped.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env['S3_BUCKET_NAME'] || undefined;
  // Without WHEN_REQUIRED, presigned PUT URLs include a checksum of an empty
  // body, and S3 rejects every real upload made with them.
  private readonly s3 = new S3Client({
    region: process.env['AWS_REGION'],
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  // A presigned PUT URL with the content type and size signed in, so S3
  // rejects an upload whose Content-Type or Content-Length doesn't match.
  async getUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRES_IN * 1000);
    if (!this.bucket) {
      return { url: `https://media.invalid/${key}`, expiresAt };
    }

    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      {
        expiresIn: UPLOAD_URL_EXPIRES_IN,
        // content-length is signed by default, content-type isn't
        signableHeaders: new Set(['content-type']),
      },
    );
    return { url, expiresAt };
  }

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
