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

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;

/**
 * Where the API client gets the token it sends as `Authorization: Bearer`.
 *
 * ACCT-1 (#29) registers Clerk's `getToken` once, from a component inside
 * ClerkProvider: `useEffect(() => setAuthTokenGetter(getToken), [getToken])`.
 */
export function setAuthTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

/** The current session token, or null when signed out (always null until #29). */
export function getAuthToken(): Promise<string | null> {
  return tokenGetter();
}
