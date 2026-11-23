// Where the drop-a-pin map starts (#94 LOC-2). With location permission it's
// where the user is. Without it: the trip's destination (geocoded, not
// stored), then the trip's latest post that has a place, then the whole world.
// A story without a trip goes straight to the world view.
import type { PostResponse } from 'shared-types';

export type LatLng = { latitude: number; longitude: number };

export type PinStartSource = 'device' | 'destination' | 'trip-post' | 'world';

export type PinStart = {
  center: LatLng;
  source: PinStartSource;
  // How many degrees of latitude the map shows at first
  latitudeDelta: number;
};

export const WORLD_CENTER: LatLng = { latitude: 20, longitude: 0 };

// Close enough to place a pin from the device and a post's place, a city for
// a destination, and the whole map otherwise
const START_DELTA: Record<PinStartSource, number> = {
  device: 0.01,
  'trip-post': 0.02,
  destination: 0.2,
  world: 120,
};

export type PinStartTrip = { id: string; destination: string };

export type PinStartSources = {
  // null when permission is denied or the position can't be read
  devicePosition: () => Promise<LatLng | null>;
  // null when the text doesn't match a place
  geocode: (text: string) => Promise<LatLng | null>;
  tripPosts: (tripId: string) => Promise<PostResponse[]>;
};

function start(source: PinStartSource, center: LatLng): PinStart {
  return { source, center, latitudeDelta: START_DELTA[source] };
}

// Any step that throws or comes back empty falls through to the next one.
export async function choosePinStart(trip: PinStartTrip | null, sources: PinStartSources): Promise<PinStart> {
  const device = await sources.devicePosition().catch(() => null);
  if (device) return start('device', device);
  if (!trip) return start('world', WORLD_CENTER);

  const destination = trip.destination.trim();
  if (destination) {
    const point = await sources.geocode(destination).catch(() => null);
    if (point) return start('destination', point);
  }

  const posts = await sources.tripPosts(trip.id).catch(() => []);
  const latest = latestPostPoint(posts);
  if (latest) return start('trip-post', latest);

  return start('world', WORLD_CENTER);
}

// The place of the trip's latest post (by day, then when it was added) that
// has one. Posts with only a custom name have no coordinates.
export function latestPostPoint(posts: Pick<PostResponse, 'visitedOn' | 'createdAt' | 'location'>[]): LatLng | null {
  let latest: (typeof posts)[number] | null = null;
  for (const post of posts) {
    if (!post.location) continue;
    if (
      !latest ||
      post.visitedOn > latest.visitedOn ||
      (post.visitedOn === latest.visitedOn && post.createdAt > latest.createdAt)
    ) {
      latest = post;
    }
  }
  return latest?.location
    ? { latitude: latest.location.latitude, longitude: latest.location.longitude }
    : null;
}

// The API stores 6 decimal places (about 10 cm)
export function roundPoint(point: LatLng): LatLng {
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { latitude: round(point.latitude), longitude: round(point.longitude) };
}

// Typed coordinates (the web fallback), or null if they aren't a real point
export function parsePoint(latitude: string, longitude: string): LatLng | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}
