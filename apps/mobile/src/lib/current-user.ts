import { createContext, useContext } from 'react';

import type { UserResponse } from 'shared-types';

import type { UserSummary } from '@/api/types';

export type CurrentUserState = {
  user: UserSummary;
  /** Undefined in mock mode, where there's no session to end. */
  signOut?: () => Promise<void>;
  /** Replaces the user after they edit their profile, so every screen shows the change. */
  setUser: (user: UserResponse) => void;
};

/** Provided by AuthGate once the user is signed in and onboarded. */
export const CurrentUserContext = createContext<CurrentUserState | null>(null);

/** The signed-in user. Only call it from screens inside AuthGate. */
export function useCurrentUser(): UserSummary {
  return useCurrentUserState().user;
}

export function useSignOut(): (() => Promise<void>) | undefined {
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
