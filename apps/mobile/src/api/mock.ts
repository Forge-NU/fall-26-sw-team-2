import type { ApiErrorResponse, PaginatedResponse } from 'shared-types';

import { ApiError } from '@/api/client';

/**
 * Which endpoints return mock data, from EXPO_PUBLIC_API_MOCKS:
 * - "auto" (default): only endpoints that aren't live yet
 * - "all": every endpoint that has a mock, e.g. for a demo without the API running
 * - "none": no mocks, to try a new endpoint before marking it live
 */
export type MockMode = 'auto' | 'all' | 'none';

export function getMockMode(): MockMode {
  const mode = process.env.EXPO_PUBLIC_API_MOCKS;
  return mode === 'all' || mode === 'none' ? mode : 'auto';
}

type Endpoint<Args extends unknown[], Result> = {
  /** Set to true once the real endpoint is merged */
  live: boolean;
  real: (...args: Args) => Promise<Result>;
  mock: (...args: Args) => Promise<Result>;
};

/**
 * An endpoint that returns mock data until the real one exists. Both sides
 * take the same arguments and return the same shared-types response, so
 * screens don't change when it goes live.
 */
export function withMock<Args extends unknown[], Result>({
  live,
  real,
  mock,
}: Endpoint<Args, Result>): (...args: Args) => Promise<Result> {
  return (...args) => {
    const mode = getMockMode();
    const useMock = mode === 'all' || (mode === 'auto' && !live);
    return useMock ? mock(...args) : real(...args);
  };
}

export const MOCK_LATENCY_MS = 400;

/** Waits like a real request would, so loading states show up. */
export function mockDelay(ms = MOCK_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One page of `items` in the API's pagination shape. The cursor is an offset here. */
export function mockPage<T>(items: T[], cursor: string | null | undefined, limit = 20): PaginatedResponse<T> {
  const start = cursor ? Number(cursor) : 0;
  const end = start + limit;
  return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null };
}

const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/** Throws the same ApiError the client throws for a real error response. */
export function mockError(statusCode: number, message: string, path = ''): never {
  const body: ApiErrorResponse = {
    statusCode,
    message,
    error: ERROR_NAMES[statusCode] ?? 'Error',
    path,
    timestamp: new Date().toISOString(),
  };
  throw new ApiError(statusCode, message, body);
}
