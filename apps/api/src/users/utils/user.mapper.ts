import type { UserSummary } from 'shared-types';

/**
 * Maps a Prisma User entity to the UserSummary shape
 */
export function mapUserToResponse(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  avatarUrl: string | null;
}): UserSummary {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
}
