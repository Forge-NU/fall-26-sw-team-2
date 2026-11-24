import type { UserSummary } from 'shared-types';

/** Full name, or the username when there's no name. No React Native imports, so tests can use it. */
export function displayName(user: Pick<UserSummary, 'firstName' | 'lastName' | 'username'>): string {
  return `${user.firstName} ${user.lastName}`.trim() || (user.username ?? '');
}
