import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const mockDeleteClerkUser = jest.fn<Promise<void>, [string]>(() =>
  Promise.resolve(),
);

jest.mock('../auth/clerk.client', () => ({
  clerkClient: {
    users: {
      deleteUser: async (userId: string): Promise<void> => {
        await mockDeleteClerkUser(userId);
      },
    },
  },
}));

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UsersService(mockPrismaService as unknown as PrismaService);
  });

  describe('findById', () => {
    it('returns a user when one exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.findById('user_123')).resolves.toEqual(mockUser);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' },
      });
    });

    it('returns null when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('missing_user')).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('creates and returns a user', async () => {
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        avatarUrl: undefined,
      };

      await expect(service.create(userData)).resolves.toEqual(mockUser);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: userData,
      });
    });
  });

  describe('update', () => {
    it('updates and returns a user', async () => {
      const updatedUser = { ...mockUser, username: 'updateduser' };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      await expect(
        service.update('user_123', { username: 'updateduser' }),
      ).resolves.toEqual(updatedUser);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { username: 'updateduser' },
      });
    });

    it('throws ConflictException when the username is already in use', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );

      mockPrismaService.user.update.mockRejectedValue(prismaError);

      await expect(
        service.update('user_123', { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: 'test',
        },
      );

      mockPrismaService.user.update.mockRejectedValue(prismaError);

      await expect(
        service.update('missing_user', { username: 'newname' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rethrows unexpected database errors', async () => {
      const error = new Error('Database unavailable');
      mockPrismaService.user.update.mockRejectedValue(error);

      await expect(
        service.update('user_123', { username: 'newname' }),
      ).rejects.toThrow(error);
    });
  });

  describe('deleteAccount', () => {
    it('deletes the Clerk user and the local user record', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockDeleteClerkUser.mockResolvedValue(undefined);
      mockPrismaService.user.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteAccount('user_123');

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' },
      });
      expect(mockDeleteClerkUser).toHaveBeenCalledWith('user_123');
      expect(mockPrismaService.user.deleteMany).toHaveBeenCalledWith({
        where: { id: 'user_123' },
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('missing_user')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDeleteClerkUser).not.toHaveBeenCalled();
      expect(mockPrismaService.user.deleteMany).not.toHaveBeenCalled();
    });

    it('does not delete the local record if Clerk deletion fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockDeleteClerkUser.mockRejectedValue(new Error('Clerk deletion failed'));

      await expect(service.deleteAccount('user_123')).rejects.toThrow(
        'Clerk deletion failed',
      );

      expect(mockPrismaService.user.deleteMany).not.toHaveBeenCalled();
    });
  });
});
