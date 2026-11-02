// STAND-IN for ACCT-1 (#29): the signed-in user comes from Clerk once auth lands.
import { me } from '@/api/mocks';

export function useCurrentUser() {
  return me;
}
