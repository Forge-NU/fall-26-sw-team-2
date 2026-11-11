import type {
  ActiveTripsResponse,
  CreateTripRequest,
  PaginatedResponse,
  TripResponse,
  UpdateTripRequest,
} from 'shared-types';

import { apiRequest } from '@/api/client';
import { withMock } from '@/api/mock';
import {
  mockCreateTrip,
  mockDeleteTrip,
  mockGetActiveTrips,
  mockGetTrip,
  mockGetUserTrips,
  mockPublishTrip,
  mockUpdateTrip,
} from '@/api/mock-backend';

// `date` is the user's local today
export const getActiveTrips = withMock({
  live: true,
  real: (date: string) =>
    apiRequest<ActiveTripsResponse>('GET', `/api/me/trips/active?date=${encodeURIComponent(date)}`),
  mock: mockGetActiveTrips,
});

export const createTrip = withMock({
  live: true,
  real: (body: CreateTripRequest) => apiRequest<TripResponse>('POST', '/api/trips', body),
  mock: mockCreateTrip,
});

export const getTrip = withMock({
  live: true,
  real: (id: string) => apiRequest<TripResponse>('GET', `/api/trips/${encodeURIComponent(id)}`),
  mock: mockGetTrip,
});

// Includes drafts only when userId is the signed-in user
export const getUserTrips = withMock({
  live: true,
  real: (userId: string, cursor?: string | null) => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return apiRequest<PaginatedResponse<TripResponse>>(
      'GET',
      `/api/users/${encodeURIComponent(userId)}/trips${query}`,
    );
  },
  mock: (userId: string, _cursor?: string | null) => mockGetUserTrips(userId),
});

export const updateTrip = withMock({
  live: true,
  real: (id: string, body: UpdateTripRequest) =>
    apiRequest<TripResponse>('PATCH', `/api/trips/${encodeURIComponent(id)}`, body),
  mock: mockUpdateTrip,
});

// Deletes the trip's posts and media too
export const deleteTrip = withMock({
  live: true,
  real: (id: string) => apiRequest<void>('DELETE', `/api/trips/${encodeURIComponent(id)}`),
  mock: mockDeleteTrip,
});

// 400 if the trip has no posts. Can't be undone.
export const publishTrip = withMock({
  live: true,
  real: (id: string) => apiRequest<TripResponse>('POST', `/api/trips/${encodeURIComponent(id)}/publish`),
  mock: mockPublishTrip,
});
