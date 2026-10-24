import { User } from '../generated/prisma/client';
import type { StorageService } from '../storage/storage.service';
import { resolveAvatarUrl } from './avatar';

// The user fields shown next to content (trip owner, post author).
// Moves to shared-types with API-1 (#28).
export type UserSummary = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

export async function toUserSummary(
  user: Pick<User, keyof typeof userSummarySelect>,
  storage: StorageService,
): Promise<UserSummary> {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: await resolveAvatarUrl(storage, user.avatarUrl),
  };
}
