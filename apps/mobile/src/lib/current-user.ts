import { createContext, useContext } from 'react';
import type { UserResponse, UserSummary } from 'shared-types';

/** AuthGate only lets users through once they've picked a username. */
export type CurrentUser = UserSummary & { username: string };

export type CurrentUserState = {
  user: CurrentUser;
  /** Ends the session and clears cached data. In mock mode it shows a mock signed-out screen. */
  signOut: () => Promise<void>;
  /** Replaces the user after they edit their profile, so every screen shows the change. */
  setUser: (user: UserResponse) => void;
};

/** Provided by AuthGate once the user is signed in and onboarded. */
export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** The signed-in user. Only call it from screens inside AuthGate. */
export function useCurrentUser(): CurrentUser {
  return useCurrentUserState().user;
}

export function useSignOut(): () => Promise<void> {
  return useCurrentUserState().signOut;
}

export function useSetCurrentUser(): (user: UserResponse) => void {
  return useCurrentUserState().setUser;
}

function useCurrentUserState(): CurrentUserState {
  const state = useContext(CurrentUserContext);
  if (!state) throw new Error('useCurrentUser must be used inside AuthGate');
  return state;
}
