/**
 * Small fetch wrapper for the Yuji API. The base URL comes from EXPO_PUBLIC_API_URL
 * (see .env.example); on a physical phone it has to be your computer's LAN IP.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Query = Record<string, string | number | undefined>;

export async function apiGet<T>(path: string, query: Query = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();

  // TODO(auth): send the Clerk session token once the app has sign-in (ACCT-1).
  const response = await fetch(`${API_URL}${path}${search ? `?${search}` : ''}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}
