/**
 * Mock data for the Yuji wireframe screens. Shapes loosely follow the trips /
 * posts / locations models in apps/api so they can be swapped for API calls.
 *
 * Media fields are optional URLs, matching what the API will return. The mock
 * data leaves them empty, so <Avatar> and <Media> draw placeholders in code and
 * no sample images live in the repo.
 */

export type FeedTab = 'local' | 'friends' | 'fyp';

type Traveler = {
  id: string;
  name: string;
  avatarUrl?: string;
  verified?: boolean;
};

export type StoryBubble = {
  id: string;
  label: string;
  avatarUrl?: string;
};

type TripDay = {
  day: number;
  title: string;
  coverUrl?: string;
  postCount: number;
};

export type Itinerary = {
  id: string;
  title: string;
  summary: string;
  location: string;
  postedAgo: string;
  postKind: string;
  /** First day of the trip (yyyy-mm-dd); the last is worked out from `days`. */
  startDate: string;
  stops: number;
  author: Traveler;
  days: TripDay[];
  saves: number;
  caption: string;
  lovedBy: string;
  feeds: FeedTab[];
};

export type ActiveTrip = {
  id: string;
  title: string;
  /** ISO dates (yyyy-mm-dd), inclusive. */
  startDate: string;
  endDate: string;
  status: 'Unpublished' | 'Published';
  suggested?: boolean;
};

export type NearbyPlace = {
  id: string;
  name: string;
  detail: string;
  distance: string;
};

const Travelers = {
  maya: { id: 'maya', name: 'Maya Chen', verified: true },
  priya: { id: 'priya', name: 'Priya Shah', verified: true },
} satisfies Record<string, Traveler>;

export const Stories: StoryBubble[] = [
  { id: 'maya', label: 'Maya' },
  { id: 'priya', label: 'Priya' },
  { id: 'lisbon', label: 'Lisbon' },
  { id: 'copenhagen', label: 'Copenhagen' },
  { id: 'yuji', label: 'Yuji' },
];

export const Itineraries: Itinerary[] = [
  {
    id: 'lisbon',
    title: '5 Days in Lisbon 🇵🇹',
    summary:
      "Sunset viewpoints, custard tarts, tram rides & hidden neighbourhoods — a full local's guide.",
    location: 'Lisbon, Portugal',
    postedAgo: '18m',
    postKind: 'Sharing itinerary',
    startDate: '2026-10-12',
    stops: 24,
    author: Travelers.maya,
    saves: 84,
    caption: 'Sunset found us right on schedule 🌞 adding this lookout to every Lisbon itinerary.',
    lovedBy: 'Loved by Noah, Priya + 246 more',
    feeds: ['local', 'friends', 'fyp'],
    days: [
      {
        day: 1,
        title: 'Belém & Alfama',
        postCount: 5,
      },
      {
        day: 2,
        title: 'Chiado & LX Factory',
        postCount: 1,
      },
      {
        day: 3,
        title: 'Sintra day trip',
        postCount: 1,
      },
      {
        day: 4,
        title: 'More to explore',
        postCount: 1,
      },
      {
        day: 5,
        title: 'One last wander',
        postCount: 1,
      },
    ],
  },
  {
    id: 'copenhagen',
    title: 'Weekend in Copenhagen 🇩🇰',
    summary:
      'Canals, open-faced sandwiches, Nyhavn harbour & world-class design — a Scandi weekend done right.',
    location: 'Copenhagen, Denmark',
    postedAgo: '1h',
    postKind: 'Weekend itinerary',
    startDate: '2026-09-18',
    stops: 14,
    author: Travelers.priya,
    saves: 57,
    caption:
      "Biked the entire city in one afternoon ☀️ Copenhagen just hits different when you're not rushing.",
    lovedBy: 'Loved by Maya, Jordan + 191 more',
    feeds: ['friends', 'fyp'],
    days: [
      {
        day: 1,
        title: 'Nyhavn & Strøget',
        postCount: 1,
      },
      {
        day: 2,
        title: 'Tivoli & Freetown',
        postCount: 1,
      },
      {
        day: 3,
        title: 'Castles & Design',
        postCount: 1,
      },
    ],
  },
];

/** Trips the signed-in traveler has running today (story composer). */
export const ActiveTrips: ActiveTrip[] = [
  {
    id: 'lisbon-solo',
    title: '5 Days in Lisbon 🇵🇹',
    startDate: '2026-10-12',
    endDate: '2026-10-16',
    status: 'Unpublished',
    suggested: true,
  },
  {
    id: 'lisbon-friends',
    title: 'Lisbon with friends 🇵🇹',
    startDate: '2026-10-13',
    endDate: '2026-10-15',
    status: 'Unpublished',
  },
];

/** Every trip the signed-in traveler hasn't published yet, including planned ones. */
export const UnpublishedTrips: ActiveTrip[] = [
  ...ActiveTrips,
  {
    id: 'porto-weekend',
    title: 'Weekend in Porto 🇵🇹',
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    status: 'Unpublished',
  },
  {
    id: 'tokyo-spring',
    title: 'Tokyo in spring 🇯🇵',
    startDate: '2027-03-20',
    endDate: '2027-03-28',
    status: 'Unpublished',
  },
];

/** Draft the story composer opens with, as if picked from the camera roll. */
export const StoryDraft = {
  /** Picked from the camera roll in the real flow. */
  mediaUrl: undefined as string | undefined,
  text: 'Sunset, right on schedule ☀️',
  song: { title: 'Golden · Harry Styles', detail: 'Music added · 15 sec' },
  capturedAt: { date: '2026-10-13', time: '18:45 WEST' },
  audience: 'Everyone',
};

export const NearbyPlaces: NearbyPlace[] = [
  {
    id: 'santa-luzia',
    name: 'Miradouro de Santa Luzia',
    detail: 'Viewpoint · Alfama, Lisbon',
    distance: '120 m',
  },
  {
    id: 'portas-do-sol',
    name: 'Miradouro das Portas do Sol',
    detail: 'Viewpoint · Largo das Portas do Sol',
    distance: '250 m',
  },
  {
    id: 'sao-jorge',
    name: 'Castelo de São Jorge',
    detail: 'Castle · Rua de Santa Cruz, Lisbon',
    distance: '650 m',
  },
];
