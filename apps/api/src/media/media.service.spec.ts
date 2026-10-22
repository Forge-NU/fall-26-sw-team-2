import { StorageService } from '../storage/storage.service';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const expiresAt = new Date('2026-10-20T12:15:00Z');
  const storage = {
    getUploadUrl: jest.fn((key: string) =>
      Promise.resolve({ url: `https://s3.test/${key}`, expiresAt }),
    ),
  };
  const service = new MediaService(storage as unknown as StorageService);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['post', 'posts'],
    ['story', 'stories'],
    ['avatar', 'avatars'],
  ] as const)(
    'puts %s uploads under users/{id}/%s/',
    async (purpose, folder) => {
      const result = await service.createUpload('user_1', {
        purpose,
        contentType: 'image/jpeg',
        fileSize: 1000,
      });

      expect(result.s3Key).toMatch(
        new RegExp(`^users/user_1/${folder}/[0-9a-f-]{36}\\.jpg$`),
      );
    },
  );

  it('passes the type and size to storage and returns the URL', async () => {
    const result = await service.createUpload('user_1', {
      purpose: 'post',
      contentType: 'image/jpeg',
      fileSize: 2483021,
    });

    expect(storage.getUploadUrl).toHaveBeenCalledWith(
      result.s3Key,
      'image/jpeg',
      2483021,
    );
    expect(result).toEqual({
      s3Key: result.s3Key,
      uploadUrl: `https://s3.test/${result.s3Key}`,
      expiresAt: '2026-10-20T12:15:00.000Z',
    });
  });

  it('gives every upload a new key', async () => {
    const dto = {
      purpose: 'post',
      contentType: 'image/jpeg',
      fileSize: 1000,
    } as const;

    const a = await service.createUpload('user_1', dto);
    const b = await service.createUpload('user_1', dto);

    expect(a.s3Key).not.toBe(b.s3Key);
  });
});
