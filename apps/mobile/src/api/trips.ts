import { apiRequest, USE_MOCK_API } from '@/api/client';
import { mockCreateTrip, mockGetActiveTrips } from '@/api/mocks';
import type {
  ActiveTripsResponse,
  CreateTripRequest,
  TripResponse,
} from '@/api/types';

// The user's active trips: drafts whose dates include `date` (their local today).
export function getActiveTrips(date: string): Promise<ActiveTripsResponse> {
  if (USE_MOCK_API) return mockGetActiveTrips(date);
  return apiRequest('GET', `/api/me/trips/active?date=${encodeURIComponent(date)}`);
}

export function createTrip(body: CreateTripRequest): Promise<TripResponse> {
  if (USE_MOCK_API) return mockCreateTrip(body);
  return apiRequest('POST', '/api/trips', body);
}
