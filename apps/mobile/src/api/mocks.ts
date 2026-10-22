// STAND-IN for APP-1 (#30): fake responses while USE_MOCK_API is on.
import { ApiError } from '@/api/client';
import type {
  ActiveTripsResponse,
  CreateStoryRequest,
  CreateTripRequest,
  StoryResponse,
  TripResponse,
  UserSummary,
} from '@/api/types';
import { addDays, isDateWithin, todayLocalIso } from '@/utils/local-date';

const MOCK_LATENCY_MS = 400;

const me: UserSummary = {
  id: 'user_mock',
  username: 'mock.traveler',
  firstName: 'Mock',
  lastName: 'Traveler',
  avatarUrl: null,
};

const trips: TripResponse[] = [];
let nextId = 1;

function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${nextId++}`;
}

function delay(ms = MOCK_LATENCY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockTrip(title: string, destination: string, startDate: string, endDate: string): TripResponse {
  const now = new Date().toISOString();
  return {
    id: mockId('trip'),
    owner: me,
    title,
    destination,
    description: null,
    startDate,
    endDate,
    status: 'draft',
    publishedAt: null,
    postCount: 0,
    coverImageUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function mockGetActiveTrips(date: string): Promise<ActiveTripsResponse> {
  await delay();
  if (trips.length === 0) {
    trips.push(
      mockTrip('Sintra and the coast', 'Portugal', addDays(date, -2), addDays(date, 3)),
      mockTrip('Lisbon weekend', 'Lisbon', date, addDays(date, 1)),
    );
  }
  return {
    items: trips.filter(
      (trip) => trip.status === 'draft' && isDateWithin(date, trip.startDate, trip.endDate),
    ),
  };
}

export async function mockCreateTrip(body: CreateTripRequest): Promise<TripResponse> {
  await delay();
  if (body.endDate < body.startDate) {
    throw new ApiError(400, 'endDate must not be before startDate');
  }
  const trip = mockTrip(body.title, body.destination, body.startDate, body.endDate);
  trips.unshift(trip);
  return trip;
}

export async function mockCreateStory(body: CreateStoryRequest): Promise<StoryResponse> {
  await delay();
  if (body.keepOnTrip && !body.tripId) {
    throw new ApiError(400, 'keepOnTrip requires tripId');
  }
  const today = body.date ?? todayLocalIso();
  const storyDate = body.storyDate ?? today;
  const trip = trips.find((t) => t.id === body.tripId);
  if (!body.tripId && storyDate !== today) {
    throw new ApiError(400, 'Without a trip, storyDate has to be today');
  }
  if (trip && !isDateWithin(storyDate, trip.startDate, trip.endDate)) {
    throw new ApiError(400, "storyDate must be within the trip's dates");
  }
  const createdAt = new Date();
  return {
    id: mockId('story'),
    owner: me,
    tripId: body.tripId ?? null,
    text: body.text ?? null,
    location: null,
    customLocationName: body.customLocationName ?? null,
    imageUrl: `https://media.invalid/${body.s3Key}`,
    keepOnTrip: body.keepOnTrip ?? false,
    storyDate,
    expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: createdAt.toISOString(),
  };
}
