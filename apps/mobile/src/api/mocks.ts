// STAND-IN: APP-1 (#30) sets up the app's pattern for mocking endpoints. Move
// these to that pattern, or delete them once the real endpoints are live.
//
// Fake responses used while USE_MOCK_API is true, typed from api/types.ts so
// they match the real endpoints. Nothing here leaves the device.
import { ApiError } from '@/api/client';
import type {
  ActiveTripsResponse,
  CreateStoryRequest,
  CreateTripRequest,
  CreateUploadResponse,
  StoryResponse,
  TripResponse,
  UploadPurpose,
  UserSummary,
} from '@/api/types';
import { addDays, isDateWithin } from '@/utils/local-date';

// Set above 0 to make uploads fail at random, to try the retry flow.
const MOCK_UPLOAD_FAILURE_RATE = 0;
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

export async function mockCreateUpload(purpose: UploadPurpose): Promise<CreateUploadResponse> {
  await delay();
  const s3Key = `users/${me.id}/${purpose === 'story' ? 'stories' : purpose}/${mockId('obj')}.jpg`;
  return { uploadUrl: `https://mock-upload.invalid/${s3Key}`, s3Key };
}

export async function mockPutObject(_uploadUrl: string): Promise<void> {
  await delay(1000);
  if (Math.random() < MOCK_UPLOAD_FAILURE_RATE) {
    throw new TypeError('Network request failed (mock)');
  }
}

export async function mockCreateStory(body: CreateStoryRequest): Promise<StoryResponse> {
  await delay();
  if (body.keepOnTrip && !body.tripId) {
    throw new ApiError(400, 'keepOnTrip requires tripId');
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
    expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: createdAt.toISOString(),
  };
}
