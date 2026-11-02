import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { CreateUploadResponse } from 'shared-types';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { StorageService } from '../storage/storage.service';
import { MediaController } from './media.controller';
import { MAX_PHOTO_BYTES } from './media-limits';
import { MediaService } from './media.service';

// Runs the real validation pipe, so these check what the server rejects.
describe('POST /media/uploads', () => {
  let app: INestApplication<App>;
  const storage = {
    getUploadUrl: jest.fn((key: string) =>
      Promise.resolve({
        url: `https://s3.test/${key}`,
        expiresAt: new Date('2026-10-20T12:15:00Z'),
      }),
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [MediaService, { provide: StorageService, useValue: storage }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest<{ user: object }>().user = {
            userId: 'user_1',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    // Same pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  const valid = {
    purpose: 'post',
    contentType: 'image/jpeg',
    fileSize: 2483021,
  };

  it('returns an upload URL and key', async () => {
    const res = await request(app.getHttpServer())
      .post('/media/uploads')
      .send(valid)
      .expect(201);

    const body = res.body as CreateUploadResponse;
    expect(body.s3Key).toMatch(/^users\/user_1\/posts\/.+\.jpg$/);
    expect(body.uploadUrl).toBe(`https://s3.test/${body.s3Key}`);
    expect(body.expiresAt).toBe('2026-10-20T12:15:00.000Z');
  });

  it('accepts a file of exactly 10 MB', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads')
      .send({ ...valid, fileSize: MAX_PHOTO_BYTES })
      .expect(201);
  });

  it.each([
    ['over 10 MB', { fileSize: MAX_PHOTO_BYTES + 1 }],
    ['empty', { fileSize: 0 }],
    ['not a whole number of bytes', { fileSize: 10.5 }],
    ['not a JPEG', { contentType: 'image/png' }],
    ['a video', { contentType: 'video/mp4' }],
    ['an unknown purpose', { purpose: 'cover' }],
  ])('rejects a file that is %s', async (_, change) => {
    await request(app.getHttpServer())
      .post('/media/uploads')
      .send({ ...valid, ...change })
      .expect(400);
    expect(storage.getUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects a request missing the file size', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads')
      .send({ purpose: 'post', contentType: 'image/jpeg' })
      .expect(400);
  });

  it('rejects a client-chosen key', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads')
      .send({ ...valid, s3Key: 'users/someone_else/posts/a.jpg' })
      .expect(400);
  });
});
