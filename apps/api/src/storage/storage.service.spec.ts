import { Logger } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const originalBucket = process.env['S3_BUCKET_NAME'];
  let logError: jest.SpyInstance;

  beforeEach(() => {
    process.env['S3_BUCKET_NAME'] = 'test-bucket';
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env['S3_BUCKET_NAME'] = originalBucket;
    jest.restoreAllMocks();
  });

  describe('getUploadUrl', () => {
    // Signing runs locally, but needs a region and credentials to exist
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env['AWS_REGION'] = 'us-east-1';
      process.env['AWS_ACCESS_KEY_ID'] = 'test-key';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret';
    });

    afterEach(() => {
      for (const name of [
        'AWS_REGION',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ]) {
        if (originalEnv[name] === undefined) delete process.env[name];
        else process.env[name] = originalEnv[name];
      }
    });

    it('signs the content type and size into a PUT URL', async () => {
      const service = new StorageService();

      const { url, expiresAt } = await service.getUploadUrl(
        'users/u/posts/a.jpg',
        'image/jpeg',
        1234,
      );

      const params = new URL(url).searchParams;
      expect(url).toContain('users/u/posts/a.jpg');
      expect(params.get('X-Amz-SignedHeaders')).toBe(
        'content-length;content-type;host',
      );
      expect(params.get('X-Amz-Expires')).toBe('900');
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("doesn't add a checksum, which would break every upload", async () => {
      const service = new StorageService();

      const { url } = await service.getUploadUrl(
        'users/u/posts/a.jpg',
        'image/jpeg',
        1234,
      );

      const keys = [...new URL(url).searchParams.keys()].map((k) =>
        k.toLowerCase(),
      );
      expect(keys.some((k) => k.includes('checksum'))).toBe(false);
    });

    it('returns a media.invalid URL without a bucket configured', async () => {
      delete process.env['S3_BUCKET_NAME'];
      const service = new StorageService();

      const { url } = await service.getUploadUrl(
        'users/u/posts/a.jpg',
        'image/jpeg',
        1234,
      );

      expect(url).toBe('https://media.invalid/users/u/posts/a.jpg');
    });
  });

  describe('deleteObjects', () => {
    it("doesn't throw when S3 fails, and logs the keys", async () => {
      jest
        .spyOn(S3Client.prototype, 'send')
        .mockRejectedValue(new Error('S3 is down') as never);
      const service = new StorageService();

      await expect(
        service.deleteObjects(['users/u/posts/a.jpg']),
      ).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('users/u/posts/a.jpg'),
        expect.any(String),
      );
    });

    it('logs keys S3 reports as failed', async () => {
      jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        Errors: [{ Key: 'users/u/posts/b.jpg' }],
      } as never);
      const service = new StorageService();

      await service.deleteObjects([
        'users/u/posts/a.jpg',
        'users/u/posts/b.jpg',
      ]);

      expect(logError).toHaveBeenCalledWith(
        'Failed to delete S3 objects: users/u/posts/b.jpg',
      );
    });

    it('sends at most 1,000 keys per request', async () => {
      const send = jest
        .spyOn(S3Client.prototype, 'send')
        .mockResolvedValue({} as never);
      const service = new StorageService();
      const keys = Array.from({ length: 2500 }, (_, i) => `users/u/posts/${i}`);

      await service.deleteObjects(keys);

      expect(send).toHaveBeenCalledTimes(3);
    });

    it('skips S3 without a bucket configured', async () => {
      delete process.env['S3_BUCKET_NAME'];
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const send = jest.spyOn(S3Client.prototype, 'send');
      const service = new StorageService();

      await service.deleteObjects(['users/u/posts/a.jpg']);

      expect(send).not.toHaveBeenCalled();
    });
  });
});
