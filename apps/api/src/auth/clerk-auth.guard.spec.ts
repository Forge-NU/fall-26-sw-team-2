import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { clerkClient } from './clerk.client';

jest.mock('./clerk.client', () => ({
  clerkClient: {
    authenticateRequest: jest.fn(),
  },
}));

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;

  const mockAuthenticateRequest = clerkClient.authenticateRequest as jest.Mock;

  const mockRequest = {
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
    originalUrl: '/api/me',
    method: 'GET',
    headers: {},
  };

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ClerkAuthGuard();
  });

  it('allows an authenticated request and attaches the user ID', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_123' }),
    });

    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    expect(mockRequest).toHaveProperty('user', { userId: 'user_123' });
  });

  it('rejects an unauthenticated request', async () => {
    mockAuthenticateRequest.mockResolvedValue({
      isAuthenticated: false,
    });

    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects requests when Clerk authentication throws', async () => {
    mockAuthenticateRequest.mockRejectedValue(
      new Error('Authentication failed'),
    );
    await expect(guard.canActivate(mockContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
