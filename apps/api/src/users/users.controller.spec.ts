import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FollowsService } from '../follows/follows.service';

describe('UsersController', () => {
  let controller: UsersController;
  const mockFollowsService = { getCounts: jest.fn() };

  const mockUsersService = {
    findById: jest.fn(),
    update: jest.fn(),
    deleteAccount: jest.fn(),
  };

  const mockUser = {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    avatarUrl: null,
  };

  const request = {
    user: { userId: 'user_123' },
  } as never;

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

      await expect(controller.getMe(request)).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        avatarUrl: null,
      });

      expect(mockUsersService.findById).toHaveBeenCalledWith('user_123');
    });

    it('throws NotFoundException when the current user does not exist', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(controller.getMe(request)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates and returns the current user profile', async () => {
      const dto = { username: 'updateduser' };
      const updatedUser = { ...mockUser, username: 'updateduser' };

      mockUsersService.update.mockResolvedValue(updatedUser);

      await expect(controller.updateMe(request, dto)).resolves.toEqual({
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
        controller.updateMe(request, { username: 'updateduser' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteMe', () => {
    it('deletes the current user account', async () => {
      mockUsersService.deleteAccount.mockResolvedValue(undefined);

      await expect(controller.deleteMe(request)).resolves.toBeUndefined();

      expect(mockUsersService.deleteAccount).toHaveBeenCalledWith('user_123');
    });

    it('propagates errors from account deletion', async () => {
      mockUsersService.deleteAccount.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.deleteMe(request)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findById', () => {
    it('returns a user profile by ID', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      await expect(controller.findById('user_123')).resolves.toEqual({
        followerCount: 3,
        followingCount: 2,
        id: 'user_123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        avatarUrl: null,
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
});
