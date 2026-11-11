import type { UserSummary } from 'shared-types';
import { resolveAvatarUrl } from '../../common/avatar';
import type { StorageService } from '../../storage/storage.service';

/**
 * Maps a Prisma User entity to the UserSummary shape
 */
export async function mapUserToResponse(
  storage: StorageService,
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string | null;
    avatarUrl: string | null;
  },
): Promise<UserSummary> {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    avatarUrl: await resolveAvatarUrl(storage, user.avatarUrl),
  };
}
