import type { ApiErrorResponse } from 'shared-types';

import { getAuthToken } from '@/lib/auth';

/**
 * Base URL of the Yuji API, without the /api prefix. Set per environment with
 * EXPO_PUBLIC_API_URL (see .env.example); on a physical phone use your computer's LAN IP.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** A response with a non-2xx status. Network failures stay as the TypeError fetch throws. */
export class ApiError extends Error {
  readonly status: number;
  /** null when the body wasn't the API's error shape, e.g. a proxy's error page */
  readonly body: ApiErrorResponse | null;

  constructor(status: number, message: string, body: ApiErrorResponse | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  /** Added to the URL; null and undefined values are left out */
  query?: Query;
  signal?: AbortSignal;
};

/** Calls the API with the signed-in user's token. Throws ApiError for non-2xx responses. */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw await toApiError(response, method, path);
  }
  // 204, or a 200 with an empty body
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(path: string, query?: Query, options: Omit<RequestOptions, 'query'> = {}): Promise<T> {
  return apiRequest<T>('GET', path, undefined, { ...options, query });
}

/** What to tell the user about a failed request. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "You've been signed out. Sign in again to keep going.";
    if (error.status >= 500) return 'Something went wrong on our end. Try again.';
    return error.body?.message ?? 'Something went wrong. Try again.';
  }
  if (error instanceof TypeError) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong. Try again.';
}

function buildUrl(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
}

async function toApiError(response: Response, method: HttpMethod, path: string): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (isApiErrorResponse(body)) {
    return new ApiError(response.status, body.message, body);
  }
  return new ApiError(response.status, `${method} ${path} failed with ${response.status}`);
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Partial<ApiErrorResponse>;
  return typeof body.statusCode === 'number' && typeof body.message === 'string';
}
