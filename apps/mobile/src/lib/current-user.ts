import { createContext, useContext } from 'react';
import type { UserSummary } from 'shared-types';

/** AuthGate only lets users through once they've picked a username. */
export type CurrentUser = UserSummary & { username: string };

export type CurrentUserState = {
  user: CurrentUser;
  /** Undefined in mock mode, where there's no session to end. */
  signOut?: () => Promise<void>;
};

/** Provided by AuthGate once the user is signed in and onboarded. */
export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** The signed-in user. Only call it from screens inside AuthGate. */
export function useCurrentUser(): CurrentUser {
  return useCurrentUserState().user;
}

export function useSignOut(): (() => Promise<void>) | undefined {
  return useCurrentUserState().signOut;
}

function useCurrentUserState(): CurrentUserState {
  const state = useContext(CurrentUserContext);
  if (!state) throw new Error('useCurrentUser must be used inside AuthGate');
  return state;
}
