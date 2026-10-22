import type { UserResponse } from 'shared-types';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export async function apiRequest<T>(path: string, getToken: () => Promise<string | null>, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${apiBaseUrl}/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new ApiError(response.status, message ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getMyProfile(getToken: () => Promise<string | null>) {
  return apiRequest<UserResponse>('/me', getToken);
}
