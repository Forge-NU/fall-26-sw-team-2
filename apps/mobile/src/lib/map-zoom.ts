import type { LatLng, ZoomLevel } from '@/components/explore/types';

export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export const WORLD_MIN_DELTA = 30;
const CITY_MAX_DELTA = 1.2;

// latitudeDelta thresholds: > 30° shows countries, > 1.2° shows areas, else places.
export function zoomLevelFor(latitudeDelta: number): ZoomLevel {
  if (latitudeDelta > WORLD_MIN_DELTA) return 'world';
  if (latitudeDelta > CITY_MAX_DELTA) return 'region';
  return 'city';
}

/**
 * A region that shows `latitudeDelta` degrees top to bottom on a screen with this
 * aspect ratio (width / height). The map grows whichever span is too small to fill
 * the screen, so a square region on a tall phone would show far more latitude than
 * asked for. Sizing the longitude to match keeps the latitude span as requested.
 */
export function regionFor(center: LatLng, latitudeDelta: number, aspect: number): MapRegion {
  // On a Mercator map, a degree of latitude is 1/cos(lat) times taller than a degree of longitude is wide.
  const cosLat = Math.max(0.1, Math.cos((center.latitude * Math.PI) / 180));
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta,
    longitudeDelta: Math.min(360, (latitudeDelta * aspect) / cosLat),
  };
}

/** Zooms a region in (factor < 1) or out (factor > 1) around its center, within the map's limits. */
export function zoomRegion(region: MapRegion, factor: number): MapRegion {
  return {
    ...region,
    latitudeDelta: Math.min(150, Math.max(0.002, region.latitudeDelta * factor)),
    longitudeDelta: Math.min(300, Math.max(0.002, region.longitudeDelta * factor)),
  };
}

function distanceSq(a: LatLng, b: LatLng) {
  const dLat = a.latitude - b.latitude;
  const dLng = (a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

export function nearest<T extends { coordinate: LatLng }>(items: T[], point: LatLng): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const item of items) {
    const d = distanceSq(item.coordinate, point);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

/** Log-scaled 0–1 weight, so one very busy pin doesn't shrink all the others. */
export function logWeight(values: number[]): (v: number) => number {
  const max = Math.max(1, ...values);
  if (max <= 1) return () => 0.5;
  return (v) => Math.log(v + 1) / Math.log(max + 1);
}
