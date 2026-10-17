// STAND-IN: APP-1 (#30) owns the app's API client (base URL per environment,
// auth hook, error toast). This minimal version only exists so STORY-2 (#24)
// can be built before APP-1 lands. Replace it with APP-1's client then.

// TODO: set to false once the real endpoints are merged and the app can sign
// in: uploads (#38 MEDIA-1), trips (#56), stories (#61). Must be false in any
// release build.
export const USE_MOCK_API = true;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// A response with a non-2xx status. Callers decide what to do from the status
// alone, since the error body's shape changes with API-1 (#28).
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
