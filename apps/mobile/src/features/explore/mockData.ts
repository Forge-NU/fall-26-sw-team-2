import type { Area, Country, Person, Place, Stats, StatsByAudience } from './types';

// Temporary data until the API is ready. See docs/design/explore.md for the endpoints.

const NONE: Stats = { rating: 0, reviews: 0, logs: 0, people: 0 };
const s = (rating: number, reviews: number, logs: number, people: number): Stats => ({
  rating,
  reviews,
  logs,
  people,
});
const by = (me: Stats | null, friends: Stats, global: Stats): StatsByAudience => ({
  me: me ?? NONE,
  friends,
  global,
});

export const LISBON_REGION = {
  latitude: 38.7115,
  longitude: -9.1415,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

export const COUNTRIES: Country[] = [
  { id: 'pt', name: 'Portugal', coordinate: { latitude: 39.6, longitude: -8.0 }, zoomDelta: 6 },
  { id: 'jp', name: 'Japan', coordinate: { latitude: 36.2, longitude: 138.25 }, zoomDelta: 10 },
  { id: 'ca', name: 'Canada', coordinate: { latitude: 56.1, longitude: -106.3 }, zoomDelta: 30 },
  { id: 'br', name: 'Brazil', coordinate: { latitude: -14.2, longitude: -51.9 }, zoomDelta: 30 },
  { id: 'au', name: 'Australia', coordinate: { latitude: -25.3, longitude: 133.8 }, zoomDelta: 30 },
];

export const AREAS: Area[] = [
  { id: 'lisbon', name: 'Lisbon', countryId: 'pt', label: 'City / vacation', coordinate: { latitude: 38.7115, longitude: -9.1415 } },
  { id: 'porto', name: 'Porto', countryId: 'pt', label: 'City / vacation', coordinate: { latitude: 41.1445, longitude: -8.6131 } },
  { id: 'tokyo', name: 'Tokyo', countryId: 'jp', label: 'City / vacation', coordinate: { latitude: 35.6895, longitude: 139.7003 } },
  { id: 'kyoto', name: 'Kyoto', countryId: 'jp', label: 'City / culture', coordinate: { latitude: 35.0036, longitude: 135.7788 } },
  { id: 'toronto', name: 'Toronto', countryId: 'ca', label: 'City / vacation', coordinate: { latitude: 43.6426, longitude: -79.3871 } },
  { id: 'rio', name: 'Rio de Janeiro', countryId: 'br', label: 'City / beach', coordinate: { latitude: -22.9519, longitude: -43.2105 } },
  { id: 'sydney', name: 'Sydney', countryId: 'au', label: 'City / vacation', coordinate: { latitude: -33.8568, longitude: 151.2153 } },
];

const SAM = 'u1';
const MAYA = 'u2';
const p = (id: string, name: string, saves: number, reviews: number, title: string, location = 'Lisbon'): Person => ({
  id,
  name,
  saves,
  reviews,
  trip: { id: `trip-${id}-${title}`, title, location },
});
const photo = (seed: string, saves: number) => ({ id: seed, uri: `https://picsum.photos/seed/${seed}/480/320`, saves });

export const PLACES: Place[] = [
  {
    id: 'portas-do-sol', name: 'Miradouro das Portas do Sol', kind: 'place', category: 'sightseeing',
    type: 'Viewpoint', neighborhood: 'Alfama', areaId: 'lisbon',
    coordinate: { latitude: 38.7123, longitude: -9.1307 },
    stats: by(s(5, 1, 1, 1), s(4.8, 20, 18, 6), s(4.7, 96, 124, 98)),
    tip: { text: 'Sunset river views', author: 'Maya' },
    quote: { text: 'Go at sunset for the best river views.', author: 'Maya' },
    photos: [photo('portas1', 128), photo('portas2', 94), photo('portas3', 76)],
    people: [
      p(SAM, 'Sam', 12, 18, '4-day trip'),
      p(MAYA, 'Maya', 4, 9, 'Weekend itinerary'),
      p('u3', 'Jo', 7, 3, 'Portugal in 10 days'),
      p('u4', 'Priya', 2, 12, 'Lisbon food crawl'),
    ],
    friendNames: ['Sam', 'Maya', 'Jo', 'Priya', 'Leo', 'Ana'],
  },
  {
    id: 'bairro-alto', name: 'Bairro Alto', kind: 'place', category: 'sightseeing',
    type: 'Neighborhood', neighborhood: 'Bairro Alto', areaId: 'lisbon',
    coordinate: { latitude: 38.7128, longitude: -9.1456 },
    stats: by(s(4, 1, 2, 1), s(4.7, 15, 22, 7), s(4.5, 310, 420, 360)),
    tip: { text: 'Best after 10pm on weekends', author: 'Jo' },
    photos: [photo('bairro1', 61), photo('bairro2', 40)],
    people: [p('u3', 'Jo', 5, 6, 'Portugal in 10 days'), p(SAM, 'Sam', 3, 4, '4-day trip')],
    friendNames: ['Jo', 'Sam', 'Leo'],
  },
  {
    id: 'tram-28', name: 'Ride Tram 28', kind: 'activity', category: 'activities',
    type: 'Tram route', neighborhood: 'Martim Moniz', areaId: 'lisbon',
    coordinate: { latitude: 38.7163, longitude: -9.1361 },
    stats: by(null, s(4.6, 7, 8, 4), s(4.2, 410, 540, 500)),
    quote: { text: 'Board at Martim Moniz to get a seat.', author: 'Priya' },
    photos: [photo('tram1', 88), photo('tram2', 52)],
    people: [p('u4', 'Priya', 6, 5, 'Lisbon food crawl'), p(MAYA, 'Maya', 2, 2, 'Weekend itinerary')],
    friendNames: ['Priya', 'Maya'],
  },
  {
    id: 'time-out-market', name: 'Time Out Market', kind: 'place', category: 'food',
    type: 'Food hall', neighborhood: 'Cais do Sodré', areaId: 'lisbon',
    coordinate: { latitude: 38.7069, longitude: -9.1459 },
    stats: by(s(4, 1, 1, 1), s(4.4, 12, 14, 8), s(4.3, 520, 610, 480)),
    tip: { text: 'Weekdays around 3pm skip the lunch rush', author: 'Jo' },
    photos: [photo('market1', 70), photo('market2', 33)],
    people: [p('u3', 'Jo', 4, 7, 'Portugal in 10 days')],
    friendNames: ['Jo', 'Priya', 'Sam'],
  },
  {
    id: 'manteigaria', name: 'Manteigaria', kind: 'place', category: 'food',
    type: 'Bakery', neighborhood: 'Chiado', areaId: 'lisbon',
    coordinate: { latitude: 38.7105, longitude: -9.1427 },
    stats: by(null, s(4.9, 9, 10, 6), s(4.8, 380, 450, 400)),
    quote: { text: 'Get them warm, with cinnamon.', author: 'Sam' },
    photos: [photo('nata1', 140)],
    people: [p(SAM, 'Sam', 9, 3, '4-day trip')],
    friendNames: ['Sam', 'Ana', 'Leo'],
  },
  {
    id: 'castelo', name: 'Castelo de São Jorge', kind: 'place', category: 'sightseeing',
    type: 'Castle', neighborhood: 'Alfama', areaId: 'lisbon',
    coordinate: { latitude: 38.7139, longitude: -9.1335 },
    stats: by(null, s(4.5, 6, 11, 5), s(4.6, 700, 890, 760)),
    photos: [photo('castelo1', 55)],
    people: [],
    friendNames: ['Leo', 'Maya'],
  },
  {
    id: 'memmo-alfama', name: 'Memmo Alfama', kind: 'place', category: 'hotels',
    type: 'Hotel', neighborhood: 'Alfama', areaId: 'lisbon',
    coordinate: { latitude: 38.711, longitude: -9.131 },
    stats: by(null, s(4.7, 3, 3, 2), s(4.6, 140, 150, 140)),
    photos: [],
    people: [],
    friendNames: ['Ana'],
  },
  {
    id: 'lx-factory', name: 'LX Factory', kind: 'place', category: 'activities',
    type: 'Market', neighborhood: 'Alcântara', areaId: 'lisbon',
    coordinate: { latitude: 38.7037, longitude: -9.1784 },
    stats: by(null, s(4.3, 4, 5, 3), s(4.4, 260, 330, 290)),
    photos: [photo('lx1', 47)],
    people: [],
    friendNames: ['Sam'],
  },
  // Porto
  {
    id: 'ribeira', name: 'Cais da Ribeira', kind: 'place', category: 'sightseeing',
    type: 'Riverfront', neighborhood: 'Ribeira', areaId: 'porto',
    coordinate: { latitude: 41.1406, longitude: -8.6128 },
    stats: by(s(4.5, 1, 2, 1), s(4.7, 11, 16, 5), s(4.7, 640, 820, 700)),
    quote: { text: 'Grab a table by the water at golden hour.', author: 'Leo' },
    photos: [photo('ribeira1', 64)], people: [], friendNames: ['Leo', 'Ana', 'Jo'],
  },
  {
    id: 'livraria-lello', name: 'Livraria Lello', kind: 'place', category: 'sightseeing',
    type: 'Bookshop', neighborhood: 'Vitória', areaId: 'porto',
    coordinate: { latitude: 41.1469, longitude: -8.6149 },
    stats: by(null, s(4.4, 7, 9, 4), s(4.3, 980, 1200, 1100)),
    photos: [], people: [], friendNames: ['Ana', 'Priya'],
  },
  // Tokyo
  {
    id: 'senso-ji', name: 'Sensō-ji', kind: 'place', category: 'sightseeing',
    type: 'Temple', neighborhood: 'Asakusa', areaId: 'tokyo',
    coordinate: { latitude: 35.7148, longitude: 139.7967 },
    stats: by(s(5, 1, 2, 1), s(4.9, 18, 24, 8), s(4.8, 2100, 2600, 2300)),
    tip: { text: 'Go before 8am for an empty main hall', author: 'Sam' },
    photos: [photo('sensoji1', 150), photo('sensoji2', 82)],
    people: [p(SAM, 'Sam', 10, 6, 'Two weeks in Japan', 'Tokyo')],
    friendNames: ['Sam', 'Maya', 'Leo', 'Priya'],
  },
  {
    id: 'tsukiji', name: 'Tsukiji Outer Market', kind: 'place', category: 'food',
    type: 'Market', neighborhood: 'Tsukiji', areaId: 'tokyo',
    coordinate: { latitude: 35.6654, longitude: 139.7707 },
    stats: by(null, s(4.8, 14, 17, 7), s(4.6, 1700, 2000, 1800)),
    quote: { text: 'Tamagoyaki on a stick. Trust me.', author: 'Maya' },
    photos: [photo('tsukiji1', 90)], people: [], friendNames: ['Maya', 'Jo', 'Ana'],
  },
  {
    id: 'shibuya-crossing', name: 'Shibuya Crossing', kind: 'activity', category: 'activities',
    type: 'Landmark', neighborhood: 'Shibuya', areaId: 'tokyo',
    coordinate: { latitude: 35.6595, longitude: 139.7005 },
    stats: by(s(4.8, 1, 1, 1), s(4.7, 10, 12, 6), s(4.5, 2500, 3100, 2900)),
    photos: [], people: [], friendNames: ['Leo', 'Sam'],
  },
  // Kyoto
  {
    id: 'fushimi-inari', name: 'Fushimi Inari Taisha', kind: 'place', category: 'sightseeing',
    type: 'Shrine', neighborhood: 'Fushimi', areaId: 'kyoto',
    coordinate: { latitude: 34.9671, longitude: 135.7727 },
    stats: by(s(5, 1, 1, 1), s(4.9, 16, 20, 7), s(4.9, 2800, 3300, 3000)),
    tip: { text: 'Keep climbing past the first gates; the crowds thin out', author: 'Priya' },
    photos: [photo('inari1', 170)], people: [], friendNames: ['Priya', 'Maya', 'Sam'],
  },
  {
    id: 'arashiyama', name: 'Arashiyama Bamboo Grove', kind: 'place', category: 'sightseeing',
    type: 'Nature walk', neighborhood: 'Arashiyama', areaId: 'kyoto',
    coordinate: { latitude: 35.017, longitude: 135.6713 },
    stats: by(null, s(4.6, 9, 11, 5), s(4.5, 1900, 2200, 2000)),
    photos: [], people: [], friendNames: ['Jo', 'Ana'],
  },
  // Toronto
  {
    id: 'cn-tower', name: 'CN Tower', kind: 'place', category: 'sightseeing',
    type: 'Observation tower', neighborhood: 'Downtown', areaId: 'toronto',
    coordinate: { latitude: 43.6426, longitude: -79.3871 },
    stats: by(null, s(4.6, 12, 15, 6), s(4.5, 2200, 2600, 2400)),
    photos: [], people: [], friendNames: ['Leo', 'Jo'],
  },
  // Rio
  {
    id: 'sugarloaf', name: 'Sugarloaf Mountain', kind: 'activity', category: 'activities',
    type: 'Cable car', neighborhood: 'Urca', areaId: 'rio',
    coordinate: { latitude: -22.9486, longitude: -43.1566 },
    stats: by(null, s(4.7, 9, 11, 4), s(4.7, 1600, 1900, 1700)),
    photos: [], people: [], friendNames: ['Ana'],
  },
  // Sydney
  {
    id: 'opera-house', name: 'Sydney Opera House', kind: 'place', category: 'sightseeing',
    type: 'Performing arts', neighborhood: 'Bennelong Point', areaId: 'sydney',
    coordinate: { latitude: -33.8568, longitude: 151.2153 },
    stats: by(null, s(4.8, 13, 16, 6), s(4.7, 2400, 2900, 2600)),
    photos: [], people: [], friendNames: ['Maya', 'Priya'],
  },
];

export const COUNTRY_BY_ID = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
