// STAND-IN for APP-1 (#30): replace with its API client.

// Off unless EXPO_PUBLIC_USE_MOCK_API=true is in .env, so builds always use
// the real API. Turn it on locally until sign-in works (#38, #56, #61).
export const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Only the status is used, since the error body changes with #28.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// TODO: return the signed-in user's token once the app has auth.
async function getAuthToken(): Promise<string | null> {
  return null;
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `${method} ${path} failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
