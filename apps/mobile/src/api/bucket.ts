// Trip buckets for #140 BUCKET-2, on #136 BUCKET-1's endpoints (contract in
// #131 COLLAB-1, docs/architecture/shared-trips.md). Not built yet, so these
// return mock data. Set `live: true` as BUCKET-1 merges.
//
// Rules (#129 DOC-3): members only. Any member can add a place; you can edit
// the note on or remove places you added, and the owner can remove any place.
// A place is in a bucket once, a bucket holds MAX_BUCKET_PLACES, and only
// Mapbox places can be added.
import type {
  BucketItemResponse,
  CreateBucketItemRequest,
  PaginatedResponse,
  PlaceSavedInResponse,
  UpdateBucketItemRequest,
} from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';
import { mockDelay, mockError, mockPage, withMock } from '@/api/mock';
import { maya, me, mockOwnTrips } from '@/api/mock-backend';
import { MOCK_PLACES, mockFindPlace, mockIsPlaceSaved } from '@/api/places';

/** The API's limit, from apps/api/src/trips/trip-rules.ts */
export const MAX_BUCKET_PLACES = 200;
export const MAX_BUCKET_NOTE_LENGTH = 280;

const bucketPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}/bucket`;
const itemPath = (id: string) => `/api/bucket-items/${encodeURIComponent(id)}`;

/** A trip's bucket, newest first. 404 unless you're on the trip. */
export const listBucket = withMock<
  [tripId: string, cursor: string | null, signal?: AbortSignal],
  PaginatedResponse<BucketItemResponse>
>({
  live: false, // true once #136 BUCKET-1 merges
  real: (tripId, cursor, signal) => apiGet(bucketPath(tripId), { cursor, limit: 20 }, { signal }),
  mock: async (tripId, cursor) => {
    await mockDelay();
    return mockPage(bucketOf(tripId, bucketPath(tripId)).map(copy), cursor);
  },
});

/** 409 if the place is already there or the bucket is full, 400 for a custom location. */
export const addToBucket = withMock<[tripId: string, body: CreateBucketItemRequest], BucketItemResponse>({
  live: false, // true once #136 BUCKET-1 merges
  real: (tripId, body) => apiRequest('POST', bucketPath(tripId), body),
  mock: async (tripId, { locationId, note }) => {
    await mockDelay();
    const path = bucketPath(tripId);
    const items = bucketOf(tripId, path);
    const location = mockFindPlace(locationId, path);
    if (items.some((item) => item.location.id === locationId)) mockError(409, 'This place is already in the bucket', path);
    if (items.length >= MAX_BUCKET_PLACES) mockError(409, `A bucket holds up to ${MAX_BUCKET_PLACES} places`, path);
    const item: BucketItemResponse = {
      id: `bucket-${nextId++}`,
      location,
      addedBy: me,
      note: checkNote(note ?? null, path),
      createdAt: new Date().toISOString(),
    };
    items.unshift(item);
    return copy(item);
  },
});

/** Only on places you added. null clears the note. */
export const updateBucketItem = withMock<[id: string, body: UpdateBucketItemRequest], BucketItemResponse>({
  live: false, // true once #136 BUCKET-1 merges
  real: (id, body) => apiRequest('PATCH', itemPath(id), body),
  mock: async (id, { note }) => {
    await mockDelay();
    const { item } = findItem(id);
    if (item.addedBy.id !== me.id) mockError(403, 'You can only edit places you added', itemPath(id));
    item.note = checkNote(note, itemPath(id));
    return copy(item);
  },
});

/** Places you added, or any place if you own the trip. */
export const removeBucketItem = withMock<[id: string], void>({
  live: false, // true once #136 BUCKET-1 merges
  real: async (id) => {
    await apiRequest('DELETE', itemPath(id));
  },
  mock: async (id) => {
    await mockDelay();
    const { tripId, items, item } = findItem(id);
    const isOwner = mockOwnTrips().some((trip) => trip.id === tripId);
    if (item.addedBy.id !== me.id && !isOwner) mockError(403, 'Only the owner can remove places others added', itemPath(id));
    items.splice(items.indexOf(item), 1);
  },
});

/** Whether you saved a place, and which of your Planning trips' buckets it's in, for the save sheet. */
export const getPlaceSavedIn = withMock<[locationId: string, signal?: AbortSignal], PlaceSavedInResponse>({
  live: false, // true once #136 BUCKET-1 merges
  real: (locationId, signal) =>
    apiGet(`/api/locations/${encodeURIComponent(locationId)}/saved-in`, undefined, { signal }),
  mock: async (locationId) => {
    await mockDelay();
    mockFindPlace(locationId, `/api/locations/${locationId}/saved-in`);
    seedBuckets();
    return {
      savedByMe: mockIsPlaceSaved(locationId),
      trips: mockOwnTrips().map((trip) => ({
        id: trip.id,
        title: trip.title,
        inBucket: (buckets.get(trip.id) ?? []).some((item) => item.location.id === locationId),
      })),
    };
  },
});

/** How many places a trip's bucket has, for the Planning list mock */
export function mockBucketCount(tripId: string): number {
  seedBuckets();
  return buckets.get(tripId)?.length ?? 0;
}

// Mock data: the mock user's trips have buckets, the first one with two
// places (one added by Maya, so you can't edit its note). Other trips are a 404,
// as if you weren't on them.

const MINUTE_MS = 60 * 1000;
let nextId = 1;
let buckets = new Map<string, BucketItemResponse[]>();
let seeded = false;

function seedBuckets() {
  if (seeded) return;
  seeded = true;
  const ago = (minutes: number) => new Date(Date.now() - minutes * MINUTE_MS).toISOString();
  buckets = new Map(mockOwnTrips().map((trip) => [trip.id, []]));
  const [first] = mockOwnTrips();
  if (!first) return;
  buckets.set(first.id, [
    {
      id: `bucket-${nextId++}`,
      location: MOCK_PLACES.quinta,
      addedBy: maya,
      note: 'The initiation well!',
      createdAt: ago(40),
    },
    { id: `bucket-${nextId++}`, location: MOCK_PLACES.pena, addedBy: me, note: null, createdAt: ago(3 * 60) },
  ]);
}

function bucketOf(tripId: string, path: string): BucketItemResponse[] {
  seedBuckets();
  return buckets.get(tripId) ?? mockError(404, 'Trip not found', path);
}

function findItem(id: string) {
  seedBuckets();
  for (const [tripId, items] of buckets) {
    const item = items.find((i) => i.id === id);
    if (item) return { tripId, items, item };
  }
  return mockError(404, 'Bucket item not found', itemPath(id));
}

function checkNote(note: string | null, path: string): string | null {
  const trimmed = note?.trim() || null;
  if (trimmed && [...trimmed].length > MAX_BUCKET_NOTE_LENGTH) {
    mockError(400, `note must be ${MAX_BUCKET_NOTE_LENGTH} characters or fewer`, path);
  }
  return trimmed;
}

function copy(item: BucketItemResponse): BucketItemResponse {
  return { ...item };
}
