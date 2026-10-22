import type { LatLng, ZoomLevel } from './types';

// latitudeDelta thresholds: > 30° shows countries, > 1.2° shows areas, else places.
export function zoomLevelFor(latitudeDelta: number): ZoomLevel {
  if (latitudeDelta > 30) return 'world';
  if (latitudeDelta > 1.2) return 'region';
  return 'city';
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
