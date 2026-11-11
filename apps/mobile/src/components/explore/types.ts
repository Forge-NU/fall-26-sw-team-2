export type Audience = 'me' | 'friends' | 'global';

/** Which layer the map shows, based on how far it's zoomed out. */
export type ZoomLevel = 'world' | 'region' | 'city';

export type Category = 'food' | 'hotels' | 'sightseeing' | 'activities';
export type CategoryFilter = 'all' | Category;

export type ResultKind = 'destination' | 'place' | 'activity';
export type KindFilter = 'all' | ResultKind;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Stats {
  rating: number; // average, out of 5
  reviews: number;
  logs: number;
  people: number; // distinct people who logged it
}

export type StatsByAudience = Record<Audience, Stats>;

/** Country and area ratings are computed from their places, so they always match. */
export interface Country {
  id: string;
  name: string;
  coordinate: LatLng;
  zoomDelta: number; // how far to zoom in when tapped
}

export interface Area {
  id: string;
  name: string;
  countryId: string;
  coordinate: LatLng;
  label: string; // e.g. "City / vacation"
}

export interface Person {
  id: string;
  name: string;
  saves: number;
  reviews: number;
  trip: { id: string; title: string; location: string };
}

export interface Photo {
  id: string;
  uri: string;
  saves: number;
}

export interface Place {
  id: string;
  name: string;
  kind: 'place' | 'activity';
  category: Category;
  type: string; // "Viewpoint", "Tram route"
  neighborhood: string;
  areaId: string;
  coordinate: LatLng;
  stats: StatsByAudience;
  tip?: { text: string; author: string };
  quote?: { text: string; author: string };
  photos: Photo[];
  people: Person[];
  friendNames: string[];
}

/** Anything drawn as a rating pin: a country, an area or a single place. */
export interface PinItem {
  key: string;
  kind: 'country' | 'area' | 'place';
  id: string;
  name: string;
  coordinate: LatLng;
  stats: Stats;
  zoomDelta: number;
  place?: Place;
}

export interface SearchResult {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  statsLine: string;
  target: { type: 'area'; area: Area } | { type: 'place'; place: Place };
}
