import { getItinerary as getMockItinerary, type Itinerary } from '@/data/mock';

/** Itineraries the feed loaded from the API, so the day screen can open them. */
const loaded = new Map<string, Itinerary>();

export function rememberItineraries(itineraries: Itinerary[]) {
  for (const itinerary of itineraries) loaded.set(itinerary.id, itinerary);
}

/** An itinerary the feed loaded this session, or one of the mock ones. */
export function getItinerary(id: string) {
  return loaded.get(id) ?? getMockItinerary(id);
}
