
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { mapUserToResponse } from './utils/user.mapper';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findById: jest.fn(),
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

  // The controller reads request.user.userId.
  const request = {
    user: { userId: 'user_123' },
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
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

      await expect(controller.getMe(request)).resolves.toEqual(
        mapUserToResponse(mockUser),
      );

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

      await expect(controller.listUsers(request, {})).resolves.toEqual({
        items: mockUsers.map(mapUserToResponse),
        nextCursor: 'dXNlcl80NTY=',
      });

      expect(mockUsersService.listUsers).toHaveBeenCalledWith({});
    });

    it('returns empty list when no users exist', async () => {
      mockUsersService.listUsers.mockResolvedValue({
        items: [],
        nextCursor: null,
      });

      await expect(controller.listUsers(request, {})).resolves.toEqual({
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

      await controller.listUsers(request, pagination);

      expect(mockUsersService.listUsers).toHaveBeenCalledWith(pagination);
    });
  });
});
