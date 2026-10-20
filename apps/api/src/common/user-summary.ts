import { User } from '../generated/prisma/client';

// The user fields shown next to content (trip owner, post author).
// Moves to shared-types with API-1 (#28).
export type UserSummary = {
  id: string;
  username: string | null;
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
