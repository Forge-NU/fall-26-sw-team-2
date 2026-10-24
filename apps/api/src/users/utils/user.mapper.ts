import { UserResponse } from 'shared-types';
import { resolveAvatarUrl } from '../../common/avatar';
import type { StorageService } from '../../storage/storage.service';

/**
 * Maps a Prisma User entity to the UserResponse shape
 */
export async function mapUserToResponse(
  storage: StorageService,
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatarUrl: string | null;
  },
): Promise<UserResponse> {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: await resolveAvatarUrl(storage, user.avatarUrl),
  };
}
