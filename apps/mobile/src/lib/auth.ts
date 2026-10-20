export type AuthState = {
  /** False while the session is still being restored, e.g. on app launch. */
  isLoaded: boolean;
  isSignedIn: boolean;
};

/**
 * The signed-in state the auth gate reads.
 *
 * STAND-IN for ACCT-1 (#29): always signed in until Clerk lands. Replace the
 * body with Clerk's `useAuth()`; the gate and navigation don't need to change.
 */
export function useAuth(): AuthState {
  return { isLoaded: true, isSignedIn: true };
}
