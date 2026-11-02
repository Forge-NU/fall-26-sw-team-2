import { apiRequest, USE_MOCK_API } from '@/api/client';
import {
  mockCreateTrip,
  mockDeleteTrip,
  mockGetActiveTrips,
  mockGetTrip,
  mockGetUserTrips,
  mockPublishTrip,
  mockUpdateTrip,
} from '@/api/mocks';
import type {
  ActiveTripsResponse,
  CreateTripRequest,
  Page,
  TripResponse,
  UpdateTripRequest,
} from '@/api/types';

// `date` is the user's local today
export function getActiveTrips(date: string): Promise<ActiveTripsResponse> {
  if (USE_MOCK_API) return mockGetActiveTrips(date);
  return apiRequest('GET', `/api/me/trips/active?date=${encodeURIComponent(date)}`);
}

export function createTrip(body: CreateTripRequest): Promise<TripResponse> {
  if (USE_MOCK_API) return mockCreateTrip(body);
  return apiRequest('POST', '/api/trips', body);
}

export function getTrip(id: string): Promise<TripResponse> {
  if (USE_MOCK_API) return mockGetTrip(id);
  return apiRequest('GET', `/api/trips/${encodeURIComponent(id)}`);
}

// Includes drafts only when userId is the signed-in user
export function getUserTrips(userId: string, cursor?: string | null): Promise<Page<TripResponse>> {
  if (USE_MOCK_API) return mockGetUserTrips(userId);
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest('GET', `/api/users/${encodeURIComponent(userId)}/trips${query}`);
}

export function updateTrip(id: string, body: UpdateTripRequest): Promise<TripResponse> {
  if (USE_MOCK_API) return mockUpdateTrip(id, body);
  return apiRequest('PATCH', `/api/trips/${encodeURIComponent(id)}`, body);
}

// Deletes the trip's posts and media too
export function deleteTrip(id: string): Promise<void> {
  if (USE_MOCK_API) return mockDeleteTrip(id);
  return apiRequest('DELETE', `/api/trips/${encodeURIComponent(id)}`);
}

// 400 if the trip has no posts. Can't be undone.
export function publishTrip(id: string): Promise<TripResponse> {
  if (USE_MOCK_API) return mockPublishTrip(id);
  return apiRequest('POST', `/api/trips/${encodeURIComponent(id)}/publish`);
}
