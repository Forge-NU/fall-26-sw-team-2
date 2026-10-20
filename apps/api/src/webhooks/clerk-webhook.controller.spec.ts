import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

jest.mock('@clerk/backend/webhooks', () => ({
  verifyWebhook: jest.fn(),
}));

describe('ClerkWebhookController', () => {
  const mockVerifyWebhook = verifyWebhook as jest.Mock;

  const mockPrismaService = {
    user: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    postMedia: {
      findMany: jest.fn(),
    },
  };

  const mockStorageService = {
    deleteObjectsStrict: jest.fn(),
  };

  const request = {
    protocol: 'https',
    get: jest.fn().mockReturnValue('example.test'),
    originalUrl: '/api/webhooks/clerk',
    method: 'POST',
    headers: {},
    rawBody: Buffer.from('{}'),
  } as unknown as RawBodyRequest<Request>;

  const clerkUser = {
    id: 'user_123',
    first_name: null,
    last_name: null,
    image_url: 'https://example.com/avatar.png',
    primary_email_address_id: 'email_123',
    email_addresses: [{ id: 'email_123', email_address: 'test@example.com' }],
  };

  let controller: ClerkWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CLERK_WEBHOOK_SIGNING_SECRET'] = 'whsec_test';
    mockPrismaService.postMedia.findMany.mockResolvedValue([]);
    controller = new ClerkWebhookController(
      mockPrismaService as unknown as PrismaService,
      mockStorageService as unknown as StorageService,
    );
  });

  it('creates a user row with no username on user.created', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: clerkUser,
    });

    await expect(controller.receive(request)).resolves.toEqual({
      received: true,
    });

    expect(mockPrismaService.user.upsert).toHaveBeenCalledWith({
      where: { id: 'user_123' },
      create: {
        id: 'user_123',
        email: 'test@example.com',
        firstName: '',
        lastName: '',
        username: null,
        avatarUrl: 'https://example.com/avatar.png',
      },
      update: {
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });

  it('does not overwrite onboarding fields when the event is retried', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: clerkUser,
    });

    await controller.receive(request);

    const [{ update }] = mockPrismaService.user.upsert.mock.calls[0] as [
      { update: Record<string, unknown> },
    ];
    expect(update).not.toHaveProperty('username');
    expect(update).not.toHaveProperty('firstName');
  });

  it('deletes the row and S3 media on user.deleted', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      data: { id: 'user_123', deleted: true },
    });
    mockPrismaService.postMedia.findMany.mockResolvedValue([
      { s3Key: 'posts/a.jpg' },
    ]);

    await controller.receive(request);

    expect(mockStorageService.deleteObjectsStrict).toHaveBeenCalledWith([
      'posts/a.jpg',
    ]);
    expect(mockPrismaService.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'user_123' },
    });
  });

  it('ignores unrelated events', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'session.created',
      data: {},
    });

    await expect(controller.receive(request)).resolves.toEqual({
      received: true,
    });

    expect(mockPrismaService.user.upsert).not.toHaveBeenCalled();
    expect(mockPrismaService.user.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature', async () => {
    mockVerifyWebhook.mockRejectedValue(new Error('bad signature'));

    await expect(controller.receive(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockPrismaService.user.upsert).not.toHaveBeenCalled();
  });

  it('fails when the signing secret is not configured', async () => {
    delete process.env['CLERK_WEBHOOK_SIGNING_SECRET'];

    await expect(controller.receive(request)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
