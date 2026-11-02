import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StoriesCleanupService } from './stories-cleanup.service';

const rows = (...keys: string[]) => keys.map((s3_key) => ({ s3_key }));

describe('StoriesCleanupService', () => {
  let service: StoriesCleanupService;

  const prisma = { $queryRaw: jest.fn() };
  const storage = { deleteObjects: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const module = await Test.createTestingModule({
      providers: [
        StoriesCleanupService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(StoriesCleanupService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('deletes expired stories that were not kept, then their S3 objects', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(rows('a.jpg', 'b.jpg'));

    await expect(service.deleteExpired()).resolves.toBe(2);

    const [[strings]] = prisma.$queryRaw.mock.calls as [[string[]]];
    const sql = strings.join('?');
    expect(sql).toContain('NOT keep_on_trip AND expires_at <= now()');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(storage.deleteObjects).toHaveBeenCalledWith(['a.jpg', 'b.jpg']);
  });

  it('keeps going in batches until a batch comes back short', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(rows('a', 'b'))
      .mockResolvedValueOnce(rows('c', 'd'))
      .mockResolvedValueOnce(rows('e'));

    await expect(service.deleteExpired(2)).resolves.toBe(5);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(storage.deleteObjects).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(storage.deleteObjects).toHaveBeenNthCalledWith(2, ['c', 'd']);
    expect(storage.deleteObjects).toHaveBeenNthCalledWith(3, ['e']);
  });

  it('stops after an empty batch', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce(rows('a', 'b'))
      .mockResolvedValueOnce([]);

    await expect(service.deleteExpired(2)).resolves.toBe(2);
    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no stories have expired', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.deleteExpired()).resolves.toBe(0);
    expect(storage.deleteObjects).not.toHaveBeenCalled();
  });

  it('defaults to batches of 1,000, the S3 DeleteObjects limit', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await service.deleteExpired();

    expect(prisma.$queryRaw.mock.calls[0]).toContain(1000);
  });
});
