import { UserResponse } from 'shared-types';

/**
 * Maps a Prisma User entity to the UserResponse shape
 */
export function mapUserToResponse(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
}): UserResponse {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
}
