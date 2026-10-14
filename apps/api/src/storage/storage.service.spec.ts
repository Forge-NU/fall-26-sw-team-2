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
