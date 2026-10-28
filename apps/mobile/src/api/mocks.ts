// STAND-IN for APP-1 (#30): fake responses while USE_MOCK_API is on.
import { ApiError } from '@/api/client';
import type {
  ActiveTripsResponse,
  CreateStoryRequest,
  CreateTripRequest,
  LocationResponse,
  Page,
  PostResponse,
  StoryResponse,
  TripResponse,
  UpdateTripRequest,
  UserSummary,
} from '@/api/types';
import { addDays, isDateWithin, todayLocalIso } from '@/utils/local-date';

const MOCK_LATENCY_MS = 400;

export const me: UserSummary = {
  id: 'user_mock',
  username: 'mock.traveler',
  firstName: 'Mock',
  lastName: 'Traveler',
  avatarUrl: null,
};

const trips: TripResponse[] = [];
const posts: PostResponse[] = [];
let seeded = false;
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

function mockLocation(name: string, city: string, latitude: number, longitude: number): LocationResponse {
  return {
    id: mockId('loc'),
    provider: 'mapbox',
    providerPlaceId: mockId('mbx'),
    name,
    address: null,
    latitude,
    longitude,
    city,
    region: null,
    countryCode: 'PT',
  };
}

function mockPost(
  trip: TripResponse,
  visitedOn: string,
  caption: string | null,
  location: LocationResponse | string,
  photoIds: number[], // picsum.photos image IDs
): PostResponse {
  const now = new Date(Date.now() + nextId).toISOString();
  return {
    id: mockId('post'),
    tripId: trip.id,
    author: me,
    caption,
    visitedOn,
    location: typeof location === 'string' ? null : location,
    customLocationName: typeof location === 'string' ? location : null,
    media: photoIds.map((photoId) => ({
      id: mockId('media'),
      mediaType: 'image',
      url: `https://picsum.photos/id/${photoId}/900/1200`,
      width: 900,
      height: 1200,
      durationMs: null,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

// The API derives postCount and coverImageUrl, so the mocks do too
function refreshDerived(trip: TripResponse) {
  const tripPosts = postsForTrip(trip.id);
  trip.postCount = tripPosts.length;
  trip.coverImageUrl = tripPosts.find((post) => post.media.length > 0)?.media[0].url ?? null;
}

function postsForTrip(tripId: string): PostResponse[] {
  return posts
    .filter((post) => post.tripId === tripId)
    .sort((a, b) => a.visitedOn.localeCompare(b.visitedOn) || a.createdAt.localeCompare(b.createdAt));
}

// One active draft with posts, one published trip, and one empty draft
function seed() {
  if (seeded) return;
  seeded = true;
  const today = todayLocalIso();

  const lisbon = mockTrip('Lisbon weekend', 'Lisbon, Portugal', addDays(today, -2), addDays(today, 1));
  lisbon.description = 'Custard tarts, tram 28 and a day trip out to Sintra.';
  const belem = mockLocation('Pastéis de Belém', 'Lisbon', 38.697464, -9.203213);
  const pena = mockLocation('Pena Palace', 'Sintra', 38.787586, -9.390616);
  const cascais = mockLocation('Praia da Rainha', 'Cascais', 38.696392, -9.420598);
  posts.push(
    mockPost(lisbon, lisbon.startDate, 'Six pastéis between the two of us. No regrets.', belem, [431, 429]),
    mockPost(lisbon, addDays(lisbon.startDate, 1), 'Tram 28 all the way up to Graça.', 'Miradouro da Graça', [1047]),
    mockPost(lisbon, today, 'Fog lifted right as we got to the top.', pena, [1040, 1039, 416]),
    mockPost(lisbon, today, 'Back down the hill for lunch.', pena, [1018]),
    mockPost(lisbon, today, null, cascais, [1050]),
  );

  const copenhagen = mockTrip('Copenhagen in spring', 'Copenhagen, Denmark', addDays(today, -60), addDays(today, -55));
  copenhagen.status = 'published';
  copenhagen.publishedAt = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
  posts.push(
    mockPost(copenhagen, copenhagen.startDate, 'Nyhavn before the crowds.', 'Nyhavn', [164]),
    mockPost(copenhagen, addDays(copenhagen.startDate, 2), 'Bikes everywhere.', 'Nørrebro', [211]),
  );

  const kyoto = mockTrip('Kyoto, someday', 'Kyoto, Japan', addDays(today, 40), addDays(today, 46));

  trips.push(lisbon, copenhagen, kyoto);
  trips.forEach(refreshDerived);
}

function findOwnTrip(id: string): TripResponse {
  seed();
  const trip = trips.find((t) => t.id === id);
  if (!trip) throw new ApiError(404, 'Trip not found');
  return trip;
}

export async function mockGetActiveTrips(date: string): Promise<ActiveTripsResponse> {
  await delay();
  seed();
  return {
    items: trips.filter(
      (trip) => trip.status === 'draft' && isDateWithin(date, trip.startDate, trip.endDate),
    ),
  };
}

export async function mockCreateTrip(body: CreateTripRequest): Promise<TripResponse> {
  await delay();
  seed();
  if (body.endDate < body.startDate) {
    throw new ApiError(400, 'endDate must not be before startDate');
  }
  const trip = mockTrip(body.title, body.destination, body.startDate, body.endDate);
  trip.description = body.description ?? null;
  trips.unshift(trip);
  return { ...trip };
}

export async function mockGetTrip(id: string): Promise<TripResponse> {
  await delay();
  return { ...findOwnTrip(id) };
}

// Newest start date first, like the API
export async function mockGetUserTrips(userId: string): Promise<Page<TripResponse>> {
  await delay();
  seed();
  const items = trips
    .filter((trip) => trip.owner.id === userId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((trip) => ({ ...trip }));
  return { items, nextCursor: null };
}

export async function mockUpdateTrip(id: string, body: UpdateTripRequest): Promise<TripResponse> {
  await delay();
  const trip = findOwnTrip(id);
  const startDate = body.startDate ?? trip.startDate;
  const endDate = body.endDate ?? trip.endDate;
  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must not be before startDate');
  }
  if (postsForTrip(id).some((post) => !isDateWithin(post.visitedOn, startDate, endDate))) {
    throw new ApiError(400, 'Some posts would fall outside the new dates');
  }
  Object.assign(trip, body, { updatedAt: new Date().toISOString() });
  return { ...trip };
}

export async function mockDeleteTrip(id: string): Promise<void> {
  await delay();
  findOwnTrip(id);
  trips.splice(trips.findIndex((t) => t.id === id), 1);
  for (let i = posts.length - 1; i >= 0; i--) {
    if (posts[i].tripId === id) posts.splice(i, 1);
  }
}

export async function mockPublishTrip(id: string): Promise<TripResponse> {
  await delay();
  const trip = findOwnTrip(id);
  if (trip.status === 'published') return { ...trip };
  if (postsForTrip(id).length === 0) {
    throw new ApiError(400, 'A trip needs at least one post before it can be published');
  }
  trip.status = 'published';
  trip.publishedAt = new Date().toISOString();
  return { ...trip };
}

export async function mockGetTripPosts(tripId: string): Promise<Page<PostResponse>> {
  await delay();
  findOwnTrip(tripId);
  return { items: postsForTrip(tripId), nextCursor: null };
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
