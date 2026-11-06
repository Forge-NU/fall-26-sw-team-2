import type { UserSummary } from 'shared-types';
import { User } from '../generated/prisma/client';

// The Prisma select for UserSummary, the user shown next to content (trip owner, post author)
export const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

export function toUserSummary(
  user: Pick<User, keyof typeof userSummarySelect>,
): UserSummary {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}
