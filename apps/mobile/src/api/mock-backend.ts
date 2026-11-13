// The fake API behind the withMock wrappers in src/api/*.ts: in-memory trips,
// posts, places and stories, seeded on first use. Every endpoint here is live,
// so these only run with EXPO_PUBLIC_API_MOCKS=all.
import type {
  ActiveTripsResponse,
  CreatePostRequest,
  CreateStoryRequest,
  CreateTripRequest,
  LocationResponse,
  PaginatedResponse,
  PlaceSuggestion,
  PostResponse,
  ResolveLocationRequest,
  ResolveLocationResponse,
  StoriesFeedResponse,
  StoryGroup,
  StoryResponse,
  TripResponse,
  TripStoriesResponse,
  UserSummary,
  UpdateTripRequest,
} from 'shared-types';

import { mockDelay, mockError } from '@/api/mock';
import type { CurrentUser } from '@/lib/current-user';
import { addDays, isDateWithin, todayLocalIso } from '@/utils/local-date';

export const me: CurrentUser = {
  id: 'user_mock',
  username: 'mock.traveler',
  firstName: 'Mock',
  lastName: 'Traveler',
  avatarUrl: null,
};

const trips: TripResponse[] = [];
const posts: PostResponse[] = [];
const stories: StoryResponse[] = [];
let seeded = false;
let nextId = 1;

function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${nextId++}`;
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
    saveCount: 0,
    savedByMe: false,
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
    rating: null,
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
    rating: null,
    media: photoIds.map((photoId) => ({
      id: mockId('media'),
      mediaType: 'image',
      url: `https://picsum.photos/id/${photoId}/900/1200`,
      width: 900,
      height: 1200,
      durationMs: null,
    })),
    likeCount: 0,
    saveCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
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

  seedStories(lisbon, copenhagen, pena);
}

const HOUR_MS = 60 * 60 * 1000;
const STORY_LIFETIME_MS = 24 * HOUR_MS;

const maya: UserSummary = { id: 'user_maya', username: 'maya.chen', firstName: 'Maya', lastName: 'Chen', avatarUrl: null };
const priya: UserSummary = { id: 'user_priya', username: 'priya.k', firstName: 'Priya', lastName: 'Kumar', avatarUrl: null };

type MockStory = {
  owner: UserSummary;
  hoursAgo: number;
  photoId: number; // picsum.photos image ID
  text?: string;
  location?: LocationResponse | string;
  trip?: TripResponse;
  /** The trip on someone else's draft, which the API hides (only tripId is sent) */
  hiddenTripId?: string;
  keepOnTrip?: boolean;
  storyDate?: string;
};

function mockStory(story: MockStory): StoryResponse {
  const createdAt = new Date(Date.now() - story.hoursAgo * HOUR_MS);
  return {
    id: mockId('story'),
    owner: story.owner,
    tripId: story.trip?.id ?? story.hiddenTripId ?? null,
    trip: story.trip ? { id: story.trip.id, title: story.trip.title } : null,
    text: story.text ?? null,
    location: typeof story.location === 'object' ? story.location : null,
    customLocationName: typeof story.location === 'string' ? story.location : null,
    imageUrl: `https://picsum.photos/id/${story.photoId}/900/1600`,
    keepOnTrip: story.keepOnTrip ?? false,
    storyDate: story.storyDate ?? todayLocalIso(),
    expiresAt: new Date(createdAt.getTime() + STORY_LIFETIME_MS).toISOString(),
    createdAt: createdAt.toISOString(),
  };
}

// The stories bar: Maya on a draft trip (link hidden), Priya on a published
// trip, and the mock user's own kept story. Plus an expired kept story, which
// only shows on the Lisbon trip page.
function seedStories(lisbon: TripResponse, copenhagen: TripResponse, pena: LocationResponse) {
  const today = todayLocalIso();
  stories.push(
    mockStory({ owner: maya, hoursAgo: 5, photoId: 1036, text: 'Golden hour in Alfama', location: 'Miradouro de Santa Luzia', hiddenTripId: 'trip-maya-draft' }),
    mockStory({ owner: maya, hoursAgo: 2, photoId: 1043, hiddenTripId: 'trip-maya-draft' }),
    mockStory({ owner: priya, hoursAgo: 8, photoId: 1015, text: 'Still thinking about this view', trip: copenhagen }),
    mockStory({ owner: priya, hoursAgo: 7, photoId: 1067 }),
    mockStory({ owner: me, hoursAgo: 1, photoId: 1040, text: 'Made it to the top', location: pena, trip: lisbon, keepOnTrip: true }),
    mockStory({ owner: me, hoursAgo: 30, photoId: 1047, text: 'First tram of the trip', location: 'Tram 28', trip: lisbon, keepOnTrip: true, storyDate: addDays(today, -1) }),
  );
}

function isActiveStory(story: StoryResponse): boolean {
  return new Date(story.expiresAt).getTime() > Date.now();
}

// Everyone in the mocks is followed, so every active story shows
export async function mockGetStoriesFeed(): Promise<StoriesFeedResponse> {
  await mockDelay();
  seed();
  const byOwner = new Map<string, StoryGroup>();
  const active = stories.filter(isActiveStory).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const story of active) {
    const group = byOwner.get(story.owner.id) ?? { owner: story.owner, stories: [] };
    group.stories.push(story);
    byOwner.set(story.owner.id, group);
  }
  const latest = (group: StoryGroup) => group.stories[group.stories.length - 1].createdAt;
  const items = [...byOwner.values()].sort((a, b) => latest(b).localeCompare(latest(a)));
  return { items, nextCursor: null };
}

export async function mockGetTripStories(tripId: string): Promise<TripStoriesResponse> {
  await mockDelay();
  findOwnTrip(tripId);
  const items = stories
    .filter((story) => story.tripId === tripId && story.keepOnTrip)
    .sort((a, b) => a.storyDate.localeCompare(b.storyDate) || a.createdAt.localeCompare(b.createdAt));
  return { items, nextCursor: null };
}

export async function mockDeleteStory(id: string): Promise<void> {
  await mockDelay();
  seed();
  const index = stories.findIndex((story) => story.id === id && story.owner.id === me.id);
  if (index === -1) mockError(404, 'Story not found');
  stories.splice(index, 1);
}

function findOwnTrip(id: string): TripResponse {
  seed();
  const trip = trips.find((t) => t.id === id);
  if (!trip) mockError(404, 'Trip not found');
  return trip;
}

export async function mockGetActiveTrips(date: string): Promise<ActiveTripsResponse> {
  await mockDelay();
  seed();
  return {
    items: trips.filter(
      (trip) => trip.status === 'draft' && isDateWithin(date, trip.startDate, trip.endDate),
    ),
  };
}

export async function mockCreateTrip(body: CreateTripRequest): Promise<TripResponse> {
  await mockDelay();
  seed();
  if (body.endDate < body.startDate) {
    mockError(400, 'endDate must not be before startDate');
  }
  const trip = mockTrip(body.title, body.destination, body.startDate, body.endDate);
  trip.description = body.description ?? null;
  trips.unshift(trip);
  return { ...trip };
}

export async function mockGetTrip(id: string): Promise<TripResponse> {
  await mockDelay();
  return { ...findOwnTrip(id) };
}

// Newest start date first, like the API
export async function mockGetUserTrips(userId: string): Promise<PaginatedResponse<TripResponse>> {
  await mockDelay();
  seed();
  const items = trips
    .filter((trip) => trip.owner.id === userId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((trip) => ({ ...trip }));
  return { items, nextCursor: null };
}

export async function mockUpdateTrip(id: string, body: UpdateTripRequest): Promise<TripResponse> {
  await mockDelay();
  const trip = findOwnTrip(id);
  const startDate = body.startDate ?? trip.startDate;
  const endDate = body.endDate ?? trip.endDate;
  if (endDate < startDate) {
    mockError(400, 'endDate must not be before startDate');
  }
  if (postsForTrip(id).some((post) => !isDateWithin(post.visitedOn, startDate, endDate))) {
    mockError(400, 'Some posts would fall outside the new dates');
  }
  Object.assign(trip, body, { updatedAt: new Date().toISOString() });
  return { ...trip };
}

export async function mockDeleteTrip(id: string): Promise<void> {
  await mockDelay();
  findOwnTrip(id);
  trips.splice(trips.findIndex((t) => t.id === id), 1);
  for (let i = posts.length - 1; i >= 0; i--) {
    if (posts[i].tripId === id) posts.splice(i, 1);
  }
}

export async function mockPublishTrip(id: string): Promise<TripResponse> {
  await mockDelay();
  const trip = findOwnTrip(id);
  if (trip.status === 'published') return { ...trip };
  if (postsForTrip(id).length === 0) {
    mockError(400, 'A trip needs at least one post before it can be published');
  }
  trip.status = 'published';
  trip.publishedAt = new Date().toISOString();
  return { ...trip };
}

export async function mockGetTripPosts(tripId: string): Promise<PaginatedResponse<PostResponse>> {
  await mockDelay();
  findOwnTrip(tripId);
  return { items: postsForTrip(tripId), nextCursor: null };
}

const MOCK_UPLOAD_PHOTO_IDS = [1015, 1036, 1043, 1050, 1067];

// Counts code points, the way Postgres does
function textLength(text: string): number {
  return [...text].length;
}

export async function mockCreatePost(body: CreatePostRequest): Promise<PostResponse> {
  await mockDelay();
  const trip = findOwnTrip(body.tripId);
  if (body.media.length < 1 || body.media.length > 30) {
    mockError(400, 'media must contain 1 to 30 items');
  }
  if (!isDateWithin(body.visitedOn, trip.startDate, trip.endDate)) {
    mockError(400, "visitedOn must be within the trip's dates");
  }
  if (Boolean(body.locationId) === Boolean(body.customLocationName)) {
    mockError(400, 'Exactly one of locationId and customLocationName is required');
  }
  if (body.rating != null && body.customLocationName) {
    mockError(400, "A post with only a custom location name can't be rated. Pick a place or drop a pin.");
  }
  if (body.rating != null && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
    mockError(400, 'rating must be a whole number from 1 to 5');
  }
  if (body.caption && textLength(body.caption) > 2200) {
    mockError(400, 'caption must be at most 2200 characters');
  }
  const location = body.locationId ? resolvedLocations.get(body.locationId) : undefined;
  if (body.locationId && !location) mockError(400, 'Location not found');
  if (location) assertPinUnused(location);

  const now = new Date().toISOString();
  const post: PostResponse = {
    id: mockId('post'),
    tripId: trip.id,
    author: me,
    caption: body.caption?.trim() || null,
    visitedOn: body.visitedOn,
    location: location ?? null,
    customLocationName: body.customLocationName?.trim() ?? null,
    rating: body.rating ?? null,
    // Uploads never really happen in mock mode, so show stock photos
    media: body.media.map((item, i) => ({
      id: mockId('media'),
      mediaType: item.mediaType,
      url: `https://picsum.photos/id/${MOCK_UPLOAD_PHOTO_IDS[(posts.length + i) % MOCK_UPLOAD_PHOTO_IDS.length]}/900/1200`,
      width: item.width ?? null,
      height: item.height ?? null,
      durationMs: item.durationMs ?? null,
    })),
    likeCount: 0,
    saveCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(post);
  refreshDerived(trip);
  return post;
}

// Places the mock search knows about, with what /retrieve would return
const mockPlaces: (PlaceSuggestion & Extract<ResolveLocationRequest, { kind: 'mapbox' }>)[] = [
  { kind: 'mapbox', mapboxId: 'mock.pena-palace', name: 'Pena Palace', description: 'Sintra, Lisbon, Portugal', latitude: 38.787586, longitude: -9.390616, city: 'Sintra', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.quinta-regaleira', name: 'Quinta da Regaleira', description: 'Sintra, Lisbon, Portugal', latitude: 38.796167, longitude: -9.395966, city: 'Sintra', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.sintra', name: 'Sintra', description: 'Lisbon, Portugal', latitude: 38.802951, longitude: -9.381692, city: 'Sintra', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.belem', name: 'Pastéis de Belém', description: 'R. de Belém 84-92, Lisbon, Portugal', latitude: 38.697464, longitude: -9.203213, city: 'Lisbon', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.belem-tower', name: 'Belém Tower', description: 'Lisbon, Portugal', latitude: 38.691584, longitude: -9.215977, city: 'Lisbon', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.lisbon', name: 'Lisbon', description: 'Portugal', latitude: 38.722252, longitude: -9.139337, city: 'Lisbon', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.praia-rainha', name: 'Praia da Rainha', description: 'Cascais, Lisbon, Portugal', latitude: 38.696392, longitude: -9.420598, city: 'Cascais', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.cascais', name: 'Cascais', description: 'Lisbon, Portugal', latitude: 38.697055, longitude: -9.42149, city: 'Cascais', region: 'Lisbon', countryCode: 'PT' },
  { kind: 'mapbox', mapboxId: 'mock.boca-inferno', name: 'Boca do Inferno', description: 'Cascais, Lisbon, Portugal', latitude: 38.69136, longitude: -9.430774, city: 'Cascais', region: 'Lisbon', countryCode: 'PT' },
];

export async function mockSearchPlaces(query: string): Promise<PlaceSuggestion[]> {
  await mockDelay(250);
  const needle = query.trim().toLowerCase();
  return mockPlaces
    .filter((place) => `${place.name} ${place.description}`.toLowerCase().includes(needle))
    .map(({ mapboxId, name, description }) => ({ mapboxId, name, description }));
}

export async function mockRetrievePlace(mapboxId: string): Promise<ResolveLocationRequest> {
  await mockDelay(150);
  const place = mockPlaces.find((p) => p.mapboxId === mapboxId);
  if (!place) mockError(404, 'Place not found');
  const { description: _description, ...request } = place;
  return request;
}

// Keyed by id. A Mapbox place is looked up by providerPlaceId, so resolving
// the same place twice reuses the row; a pin is always a new row.
const resolvedLocations = new Map<string, LocationResponse>();

// Like the API: a pin goes on one post or story
function assertPinUnused(location: LocationResponse) {
  if (location.provider !== 'custom') return;
  const used = posts.some((p) => p.location?.id === location.id) || stories.some((s) => s.location?.id === location.id);
  if (used) mockError(400, 'This pin is already on another post or story. Drop a new one.');
}

// A destination like "Lisbon, Portugal" matches the mock place named in it
export async function mockGeocodePlace(text: string): Promise<{ latitude: number; longitude: number } | null> {
  await mockDelay(150);
  const needle = text.toLowerCase();
  const place = mockPlaces.find((p) => needle.includes(p.name.toLowerCase()));
  return place ? { latitude: place.latitude, longitude: place.longitude } : null;
}

export async function mockResolveLocation(body: ResolveLocationRequest): Promise<ResolveLocationResponse> {
  await mockDelay();
  const name = body.name.trim();
  if (body.kind === 'custom') {
    if (!name || textLength(name) > 100) mockError(400, 'name must be 1 to 100 characters');
    return { kind: 'custom', name };
  }
  if (body.kind === 'pin') {
    if (!name || textLength(name) > 100) mockError(400, 'name must be 1 to 100 characters');
    const pin: LocationResponse = {
      id: mockId('loc'),
      provider: 'custom',
      providerPlaceId: mockId('pin'),
      name,
      address: null,
      latitude: body.latitude,
      longitude: body.longitude,
      city: null,
      region: null,
      countryCode: null,
      rating: null,
    };
    resolvedLocations.set(pin.id, pin);
    return { kind: 'pin', location: pin };
  }
  const existing = [...resolvedLocations.values()].find((l) => l.providerPlaceId === body.mapboxId);
  if (existing) return { kind: 'mapbox', location: existing };
  const location: LocationResponse = {
    id: mockId('loc'),
    provider: 'mapbox',
    providerPlaceId: body.mapboxId,
    name,
    address: body.address ?? null,
    latitude: body.latitude,
    longitude: body.longitude,
    city: body.city ?? null,
    region: body.region ?? null,
    countryCode: body.countryCode?.toUpperCase() ?? null,
    rating: null,
  };
  resolvedLocations.set(location.id, location);
  return { kind: 'mapbox', location };
}

export async function mockCreateStory(body: CreateStoryRequest): Promise<StoryResponse> {
  await mockDelay();
  seed();
  if (body.keepOnTrip && !body.tripId) {
    mockError(400, 'keepOnTrip requires tripId');
  }
  const today = body.date ?? todayLocalIso();
  const storyDate = body.storyDate ?? today;
  const trip = trips.find((t) => t.id === body.tripId);
  if (!body.tripId && storyDate !== today) {
    mockError(400, 'Without a trip, storyDate has to be today');
  }
  if (trip && !isDateWithin(storyDate, trip.startDate, trip.endDate)) {
    mockError(400, "storyDate must be within the trip's dates");
  }
  const storyLocation = body.locationId ? resolvedLocations.get(body.locationId) : undefined;
  if (storyLocation) assertPinUnused(storyLocation);
  const createdAt = new Date();
  const story: StoryResponse = {
    id: mockId('story'),
    owner: me,
    tripId: body.tripId ?? null,
    trip: trip ? { id: trip.id, title: trip.title } : null,
    text: body.text || null,
    location: storyLocation ?? null,
    customLocationName: body.customLocationName ?? null,
    // The mock upload has no real object behind the key, so show a stand-in photo
    imageUrl: `https://picsum.photos/id/${MOCK_UPLOAD_PHOTO_IDS[nextId % MOCK_UPLOAD_PHOTO_IDS.length]}/900/1600`,
    keepOnTrip: body.keepOnTrip ?? false,
    storyDate,
    expiresAt: new Date(createdAt.getTime() + STORY_LIFETIME_MS).toISOString(),
    createdAt: createdAt.toISOString(),
  };
  stories.push(story);
  return story;
}
