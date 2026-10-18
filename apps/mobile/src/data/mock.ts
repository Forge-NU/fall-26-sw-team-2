/**
 * Mock data for the Yuji wireframe screens. Shapes loosely follow the trips /
 * posts / locations models in apps/api so they can be swapped for API calls.
 *
 * Media fields are optional URLs, matching what the API will return. The mock
 * data leaves them empty, so <Avatar> and <Media> draw placeholders in code and
 * no sample images live in the repo.
 */

export type FeedTab = 'local' | 'friends' | 'fyp';

export type Traveler = {
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

export type Moment = {
  id: string;
  kind: 'photo' | 'video';
  imageUrl?: string;
  caption: string;
  /** Only the lead moment of a day shows a title. */
  title?: string;
  duration?: string;
};

export type DayPlace = {
  id: string;
  time: string;
  name: string;
  note: string;
};

export type TripDay = {
  day: number;
  title: string;
  summary: string;
  coverUrl?: string;
  moments: Moment[];
  places: DayPlace[];
};

export type Itinerary = {
  id: string;
  title: string;
  summary: string;
  location: string;
  postedAgo: string;
  postKind: string;
  stops: number;
  author: Traveler;
  participants: Traveler[];
  days: TripDay[];
  likes: number;
  comments: number;
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

export const Travelers = {
  maya: { id: 'maya', name: 'Maya Chen', verified: true },
  priya: { id: 'priya', name: 'Priya Shah', verified: true },
  noah: { id: 'noah', name: 'Noah Kim' },
  jordan: { id: 'jordan', name: 'Jordan Lee' },
  sam: { id: 'sam', name: 'Sam Ortiz' },
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
    stops: 24,
    author: Travelers.maya,
    participants: [Travelers.noah, Travelers.priya, Travelers.jordan, Travelers.sam],
    likes: 248,
    comments: 31,
    saves: 84,
    caption: 'Sunset found us right on schedule 🌞 adding this lookout to every Lisbon itinerary.',
    lovedBy: 'Loved by Noah, Priya + 246 more',
    feeds: ['local', 'friends', 'fyp'],
    days: [
      {
        day: 1,
        title: 'Belém & Alfama',
        summary: 'Tarts, tram rides & a golden-hour finish.',
        moments: [
          {
            id: 'l1-sunset',
            kind: 'photo',
            title: 'Golden hour at Portas do Sol',
            caption: 'Sunset, right on schedule 🌞',
          },
          { id: 'l1-belem', kind: 'photo', caption: 'Belém by the water' },
          {
            id: 'l1-pastry',
            kind: 'photo',
            caption: 'Worth the pastry queue',
          },
          {
            id: 'l1-tram',
            kind: 'video',
            caption: 'Tram 28, window seat',
            duration: '0:12',
          },
          {
            id: 'l1-alfama',
            kind: 'video',
            caption: 'Lost in Alfama',
            duration: '0:08',
          },
        ],
        places: [
          { id: 'torre', time: '09:00', name: 'Torre de Belém', note: 'Riverside wander' },
          { id: 'pasteis', time: '10:30', name: 'Pastéis de Belém', note: 'Warm tarts + espresso' },
          { id: 'tram28', time: '14:00', name: 'Tram 28', note: 'Ride into Alfama' },
          {
            id: 'portas',
            time: '18:45',
            name: 'Miradouro das Portas do Sol',
            note: 'Alfama stroll → sunset',
          },
        ],
      },
      {
        day: 2,
        title: 'Chiado & LX Factory',
        summary: 'Bookshops, rooftops & a warehouse market.',
        moments: [
          {
            id: 'l2-chiado',
            kind: 'photo',
            title: 'Morning in Chiado',
            caption: 'Yellow trams everywhere 💛',
          },
        ],
        places: [
          { id: 'bertrand', time: '10:00', name: 'Livraria Bertrand', note: "World's oldest bookshop" },
          { id: 'lxfactory', time: '15:00', name: 'LX Factory', note: 'Market + street art' },
        ],
      },
      {
        day: 3,
        title: 'Sintra day trip',
        summary: 'Palaces in the fog and a long lunch.',
        moments: [
          {
            id: 'l3-sintra',
            kind: 'photo',
            title: 'Coffee before the climb',
            caption: 'Fuel for Pena Palace ☕',
          },
        ],
        places: [
          { id: 'pena', time: '10:00', name: 'Pena Palace', note: 'Go early, skip the queue' },
          { id: 'regaleira', time: '14:30', name: 'Quinta da Regaleira', note: 'The initiation well' },
        ],
      },
      {
        day: 4,
        title: 'More to explore',
        summary: 'Riverside markets and a slow evening.',
        moments: [
          {
            id: 'l4-river',
            kind: 'photo',
            title: 'Down by the Tagus',
            caption: 'Boats, bikes & no plans',
          },
        ],
        places: [
          { id: 'ribeira', time: '12:30', name: 'Time Out Market', note: 'Lunch, one of everything' },
          { id: 'cais', time: '17:00', name: 'Cais do Sodré', note: 'Riverside sunset drinks' },
        ],
      },
      {
        day: 5,
        title: 'One last wander',
        summary: 'Backstreets, souvenirs & goodbye.',
        moments: [
          {
            id: 'l5-street',
            kind: 'photo',
            title: 'Last stroll',
            caption: 'Already planning the return',
          },
        ],
        places: [{ id: 'graca', time: '11:00', name: 'Miradouro da Graça', note: 'One final view' }],
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
    stops: 14,
    author: Travelers.priya,
    participants: [],
    likes: 193,
    comments: 24,
    saves: 57,
    caption:
      "Biked the entire city in one afternoon ☀️ Copenhagen just hits different when you're not rushing.",
    lovedBy: 'Loved by Maya, Jordan + 191 more',
    feeds: ['friends', 'fyp'],
    days: [
      {
        day: 1,
        title: 'Nyhavn & Strøget',
        summary: 'Harbour colours and a long walk.',
        moments: [
          {
            id: 'c1-nyhavn',
            kind: 'photo',
            title: 'Nyhavn at noon',
            caption: 'Every house a different colour',
          },
        ],
        places: [
          { id: 'nyhavn', time: '11:00', name: 'Nyhavn', note: 'Harbour walk' },
          { id: 'stroget', time: '14:00', name: 'Strøget', note: 'Shopping street' },
        ],
      },
      {
        day: 2,
        title: 'Tivoli & Freetown',
        summary: 'Rides, lights & Christiania.',
        moments: [
          {
            id: 'c2-tivoli',
            kind: 'photo',
            title: 'Tivoli lights',
            caption: 'Better after dark ✨',
          },
        ],
        places: [
          { id: 'tivoli', time: '18:00', name: 'Tivoli Gardens', note: 'Go for the lights' },
          { id: 'christiania', time: '13:00', name: 'Freetown Christiania', note: 'Wander, no photos' },
        ],
      },
      {
        day: 3,
        title: 'Castles & Design',
        summary: 'Rosenborg and the Design Museum.',
        moments: [
          {
            id: 'c3-castle',
            kind: 'photo',
            title: 'Rosenborg Castle',
            caption: 'Crown jewels in the basement',
          },
        ],
        places: [
          { id: 'rosenborg', time: '10:00', name: 'Rosenborg Castle', note: 'Crown jewels' },
          { id: 'design', time: '14:00', name: 'Designmuseum Danmark', note: 'Chairs, so many chairs' },
        ],
      },
    ],
  },
];

export function getItinerary(id: string) {
  return Itineraries.find((itinerary) => itinerary.id === id);
}

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
