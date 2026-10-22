import { useSyncExternalStore } from 'react';

import type { Place } from '../explore/types';

// Shared list of saved places, used by the Maps tab and the Saved tab.
// Lives in memory for now, so it clears when the app reloads. Swap this for
// API calls (e.g. POST/DELETE /saved-places) once the backend supports it.

let saved: Place[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const savedPlaces = {
  toggle(place: Place) {
    saved = saved.some((p) => p.id === place.id)
      ? saved.filter((p) => p.id !== place.id)
      : [place, ...saved];
    emit();
  },
  remove(id: string) {
    saved = saved.filter((p) => p.id !== id);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot() {
    return saved;
  },
};

/** Re-renders whenever a place is saved or removed. */
export function useSavedPlaces(): Place[] {
  return useSyncExternalStore(savedPlaces.subscribe, savedPlaces.getSnapshot, savedPlaces.getSnapshot);
}
