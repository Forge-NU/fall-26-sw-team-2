type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;

/**
 * Where the API client gets the token it sends as `Authorization: Bearer`.
 * AuthGate registers Clerk's `getToken` here, so this file stays free of Clerk
 * and the client can run in the Node tests.
 */
export function setAuthTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

/** The current session token, or null when signed out. */
export function getAuthToken(): Promise<string | null> {
  return tokenGetter();
}
