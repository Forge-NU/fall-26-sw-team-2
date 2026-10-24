import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const mockGetClerkUser = jest.fn<Promise<unknown>, [string]>();

const mockDeleteClerkUser = jest.fn<Promise<void>, [string]>(() =>
  Promise.resolve(),
);

jest.mock('../auth/clerk.client', () => ({
  clerkClient: {
    users: {
      deleteUser: async (userId: string): Promise<void> => {
        await mockDeleteClerkUser(userId);
      },
      getUser: (userId: string): Promise<unknown> => mockGetClerkUser(userId),
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
      findMany: jest.fn(),
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

  describe('createProfile', () => {
    const profileData = {
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser',
    };

    const clerkUser = {
      id: 'user_123',
      primaryEmailAddressId: 'email_123',
      emailAddresses: [
        {
          id: 'email_123',
          emailAddress: 'test@example.com',
        },
      ],
      imageUrl: 'https://example.com/avatar.png',
    };

    it('creates a profile using the authenticated Clerk user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockGetClerkUser.mockResolvedValue(clerkUser);
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      await expect(
        service.createProfile('user_123', profileData),
      ).resolves.toEqual(mockUser);

      expect(mockGetClerkUser).toHaveBeenCalledWith('user_123');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          id: 'user_123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
    });

    it('rejects profile creation if the user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createProfile('user_123', profileData),
      ).rejects.toThrow(ConflictException);

      expect(mockGetClerkUser).not.toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('rejects profile creation when there is no primary email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockGetClerkUser.mockResolvedValue({
        ...clerkUser,
        primaryEmailAddressId: null,
      });

      await expect(
        service.createProfile('user_123', profileData),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('propagates Prisma P2002 errors on create', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
        },
      );

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockGetClerkUser.mockResolvedValue(clerkUser);
      mockPrismaService.user.create.mockRejectedValue(prismaError);

      await expect(
        service.createProfile('user_123', profileData),
      ).rejects.toThrow(prismaError);
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

    it('saves an avatar key from your own uploads', async () => {
      const avatarKey =
        'users/user_123/avatars/0f8b6c3e-1d2a-4b5c-9e7f-123456789abc.jpg';
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.update('user_123', { firstName: 'Ada', avatarKey });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { firstName: 'Ada', avatarUrl: avatarKey },
      });
    });

    it('clears the avatar when avatarKey is null', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.update('user_123', { avatarKey: null });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { avatarUrl: null },
      });
    });

    it.each([
      'users/someone_else/avatars/0f8b6c3e-1d2a-4b5c-9e7f-123456789abc.jpg',
      'users/user_123/posts/0f8b6c3e-1d2a-4b5c-9e7f-123456789abc.jpg',
      'https://example.com/me.jpg',
    ])('rejects %s as an avatarKey', async (avatarKey) => {
      await expect(service.update('user_123', { avatarKey })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
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

  describe('listUsers', () => {
    it('returns paginated users without cursor', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user_456', username: 'testuser2' },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.listUsers({ limit: 20 });

      expect(result.items).toEqual(mockUsers);
      expect(result.nextCursor).toBeNull();
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {},
        take: 21,
        orderBy: { id: 'asc' },
      });
    });

    it('returns paginated users with cursor', async () => {
      const mockUsers = [
        { ...mockUser, id: 'user_456', username: 'testuser2' },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.listUsers({
        cursor: 'dXNlcl8xMjM=',
        limit: 20,
      });

      expect(result.items).toEqual(mockUsers);
      expect(result.nextCursor).toBeNull();
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { id: { gt: 'user_123' } },
        take: 21,
        orderBy: { id: 'asc' },
      });
    });

    it('returns nextCursor when there are more results', async () => {
      const mockUsers = Array.from({ length: 21 }, (_, i) => ({
        ...mockUser,
        id: `user_${i}`,
      }));

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.listUsers({ limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe('dXNlcl8xOQ==');
    });

    it('returns empty list when no users exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.listUsers({ limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
