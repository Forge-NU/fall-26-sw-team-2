import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FollowsService } from '../follows/follows.service';
import { StorageService } from '../storage/storage.service';

describe('UsersController', () => {
  let controller: UsersController;
  const mockFollowsService = { getCounts: jest.fn() };

  const mockUsersService = {
    findById: jest.fn(),
    createProfile: jest.fn(),
    update: jest.fn(),
    deleteAccount: jest.fn(),
    listUsers: jest.fn(),
  };

  const mockUser = {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    avatarUrl: null,
  };

  const userId = 'user_123';

  const mockStorageService = {
    getReadUrl: jest.fn((key: string) => Promise.resolve(`signed:${key}`)),
  };

  const toResponse = (user: typeof mockUser) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFollowsService.getCounts.mockResolvedValue({
      followerCount: 3,
      followingCount: 2,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: FollowsService, useValue: mockFollowsService },
        { provide: StorageService, useValue: mockStorageService },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('returns the current user profile', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(controller.getMe(userId)).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        ...toResponse(mockUser),
      });

      expect(mockUsersService.findById).toHaveBeenCalledWith('user_123');
    });

    it('throws NotFoundException when the current user does not exist', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(controller.getMe(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('createProfile', () => {
    it('creates and returns the user profile', async () => {
      const dto = { firstName: 'Test', lastName: 'User', username: 'testuser' };
      const createdUser = { ...mockUser };

      mockUsersService.createProfile.mockResolvedValue(createdUser);

      await expect(controller.createProfile(userId, dto)).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        ...toResponse(mockUser),
      });

      expect(mockUsersService.createProfile).toHaveBeenCalledWith(
        'user_123',
        dto,
      );
    });

    it('propagates errors from the service', async () => {
      mockUsersService.createProfile.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.createProfile(userId, {
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('updates and returns the current user profile', async () => {
      const dto = { username: 'updateduser' };
      const updatedUser = { ...mockUser, username: 'updateduser' };

      mockUsersService.update.mockResolvedValue(updatedUser);

      await expect(controller.updateMe(userId, dto)).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        username: 'updateduser',
        avatarUrl: null,
      });

      expect(mockUsersService.update).toHaveBeenCalledWith('user_123', dto);
    });

    it('propagates errors from the service', async () => {
      mockUsersService.update.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.updateMe(userId, { username: 'updateduser' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteMe', () => {
    it('deletes the current user account', async () => {
      mockUsersService.deleteAccount.mockResolvedValue(undefined);

      await expect(controller.deleteMe(userId)).resolves.toBeUndefined();

      expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('user_123');
    });

    it('propagates errors from account deletion', async () => {
      mockUsersService.deleteAccount.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.deleteMe(userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('sends a signed URL for an uploaded avatar', async () => {
    const avatarKey = `users/${userId}/avatars/0f8b6c3e-1d2a-4b5c-9e7f-123456789abc.jpg`;
    mockUsersService.findById.mockResolvedValue({
      ...mockUser,
      avatarUrl: avatarKey,
    });

    await expect(controller.getMe(userId)).resolves.toMatchObject({
      avatarUrl: `signed:${avatarKey}`,
    });
  });

  it('passes a Clerk image URL through unchanged', async () => {
    mockUsersService.findById.mockResolvedValue({
      ...mockUser,
      avatarUrl: 'https://img.clerk.com/abc',
    });

    await expect(controller.getMe(userId)).resolves.toMatchObject({
      avatarUrl: 'https://img.clerk.com/abc',
    });
  });

  describe('findById', () => {
    it('returns a user profile by ID', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(controller.findById('user_123')).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        ...toResponse(mockUser),
      });

      expect(mockUsersService.findById).toHaveBeenCalledWith('user_123');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(controller.findById('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('listUsers', () => {
    it('returns a paginated list of users', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 'user_456', username: 'testuser2' },
      ];

      mockUsersService.listUsers.mockResolvedValue({
        items: mockUsers,
        nextCursor: 'dXNlcl80NTY=',
      });

      await expect(controller.listUsers({})).resolves.toEqual({
        items: mockUsers.map(toResponse),
        nextCursor: 'dXNlcl80NTY=',
      });

      expect(mockUsersService.listUsers).toHaveBeenCalledWith({});
    });

    it('returns empty list when no users exist', async () => {
      mockUsersService.listUsers.mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      await expect(controller.listUsers({})).resolves.toEqual({
        items: [],
        nextCursor: null,
      });

      expect(mockUsersService.listUsers).toHaveBeenCalledWith({});
    });

    it('passes pagination params to service', async () => {
      mockUsersService.listUsers.mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      const pagination = {
        cursor: 'abc123',
        limit: 10,
      };

      await controller.listUsers(pagination);

      expect(mockUsersService.listUsers).toHaveBeenCalledWith(pagination);
    });
  });
});
