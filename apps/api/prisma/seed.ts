// Seed data for local dev and demos. Run with `npx prisma db seed`.
// Every row has a fixed ID and is upserted, so running this twice doesn't
// duplicate anything. #45 (DEV-1) owns the seed script overall; this covers
// the users the trips need plus the #3 tables (trips, posts, post_media,
// locations).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

const users = [
  {
    id: 'user_seed_maya',
    email: 'maya.chen@example.com',
    firstName: 'Maya',
    lastName: 'Chen',
    username: 'mayachen',
  },
  {
    id: 'user_seed_priya',
    email: 'priya.shah@example.com',
    firstName: 'Priya',
    lastName: 'Shah',
    username: 'priya.shah',
  },
  {
    id: 'user_seed_alex',
    email: 'alex.rivera@example.com',
    firstName: 'Alex',
    lastName: 'Rivera',
    username: 'alex_rivera',
  },
];

// Real places with approximate coordinates. The provider place IDs are
// placeholders until #37 (LOC-1) seeds real Mapbox IDs.
const locations = [
  {
    id: '00000000-0000-4000-a000-000000000001',
    providerPlaceId: 'seed.belem-tower',
    name: 'Belém Tower',
    address: 'Av. Brasília, 1400-038 Lisboa',
    latitude: 38.691584,
    longitude: -9.215977,
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
  },
  {
    id: '00000000-0000-4000-a000-000000000002',
    providerPlaceId: 'seed.pasteis-de-belem',
    name: 'Pastéis de Belém',
    address: 'R. de Belém 84-92, 1300-085 Lisboa',
    latitude: 38.697464,
    longitude: -9.203213,
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
  },
  {
    id: '00000000-0000-4000-a000-000000000003',
    providerPlaceId: 'seed.miradouro-santa-luzia',
    name: 'Miradouro de Santa Luzia',
    address: 'Largo Santa Luzia, 1100-487 Lisboa',
    latitude: 38.711804,
    longitude: -9.130146,
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
  },
  {
    id: '00000000-0000-4000-a000-000000000004',
    providerPlaceId: 'seed.lx-factory',
    name: 'LX Factory',
    address: 'R. Rodrigues de Faria 103, 1300-501 Lisboa',
    latitude: 38.703193,
    longitude: -9.178672,
    city: 'Lisbon',
    region: 'Lisbon',
    countryCode: 'PT',
  },
  {
    id: '00000000-0000-4000-a000-000000000005',
    providerPlaceId: 'seed.pena-palace',
    name: 'Pena Palace',
    address: 'Estrada da Pena, 2710-609 Sintra',
    latitude: 38.787573,
    longitude: -9.390569,
    city: 'Sintra',
    region: 'Lisbon',
    countryCode: 'PT',
  },
  {
    id: '00000000-0000-4000-a000-000000000006',
    providerPlaceId: 'seed.nyhavn',
    name: 'Nyhavn',
    address: 'Nyhavn, 1051 København',
    latitude: 55.679803,
    longitude: 12.590843,
    city: 'Copenhagen',
    region: 'Capital Region',
    countryCode: 'DK',
  },
  {
    id: '00000000-0000-4000-a000-000000000007',
    providerPlaceId: 'seed.tivoli-gardens',
    name: 'Tivoli Gardens',
    address: 'Vesterbrogade 3, 1630 København',
    latitude: 55.673684,
    longitude: 12.568147,
    city: 'Copenhagen',
    region: 'Capital Region',
    countryCode: 'DK',
  },
  {
    id: '00000000-0000-4000-a000-000000000008',
    providerPlaceId: 'seed.torvehallerne',
    name: 'Torvehallerne',
    address: 'Frederiksborggade 21, 1360 København',
    latitude: 55.683882,
    longitude: 12.569859,
    city: 'Copenhagen',
    region: 'Capital Region',
    countryCode: 'DK',
  },
];

// UTC midnight, `offset` days from today. Used for the active trip so it
// stays active whenever the seed is run.
function daysFromToday(offset: number) {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offset,
    ),
  );
}

const trips = [
  {
    // Published, shows up in Priya's and Alex's feeds
    id: '00000000-0000-4000-b000-000000000001',
    ownerId: 'user_seed_maya',
    title: '5 Days in Lisbon',
    destination: 'Lisbon, Portugal',
    description:
      'Sunset viewpoints, custard tarts, tram rides and a day trip to Sintra.',
    startDate: new Date('2026-09-12'),
    endDate: new Date('2026-09-16'),
    status: 'published' as const,
    publishedAt: new Date('2026-09-18T15:00:00Z'),
  },
  {
    // Draft whose dates are in the past, so it's not active
    id: '00000000-0000-4000-b000-000000000002',
    ownerId: 'user_seed_maya',
    title: 'Porto long weekend',
    destination: 'Porto, Portugal',
    description: null,
    startDate: new Date('2026-08-21'),
    endDate: new Date('2026-08-24'),
    status: 'draft' as const,
    publishedAt: null,
  },
  {
    id: '00000000-0000-4000-b000-000000000003',
    ownerId: 'user_seed_priya',
    title: 'Weekend in Copenhagen',
    destination: 'Copenhagen, Denmark',
    description: 'Canals, open-faced sandwiches, Nyhavn and a night at Tivoli.',
    startDate: new Date('2026-09-25'),
    endDate: new Date('2026-09-27'),
    status: 'published' as const,
    publishedAt: new Date('2026-09-28T10:30:00Z'),
  },
  {
    // Active trip (draft, today within its dates) for the story composer
    id: '00000000-0000-4000-b000-000000000004',
    ownerId: 'user_seed_alex',
    title: 'Sintra and the coast',
    destination: 'Sintra, Portugal',
    description: null,
    startDate: daysFromToday(-1),
    endDate: daysFromToday(3),
    status: 'draft' as const,
    publishedAt: null,
  },
];

type SeedPost = {
  id: string;
  tripId: string;
  ownerId: string;
  visitedOn: Date;
  caption: string | null;
  locationId?: string;
  customLocationName?: string;
  mediaCount: number;
};

const posts: SeedPost[] = [
  {
    id: '00000000-0000-4000-c000-000000000001',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-12'),
    caption: 'Got here right at opening and still had to queue. Worth it.',
    locationId: locations[0].id,
    mediaCount: 3,
  },
  {
    id: '00000000-0000-4000-c000-000000000002',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-12'),
    caption: 'Six pastéis between the two of us. No regrets.',
    locationId: locations[1].id,
    mediaCount: 2,
  },
  {
    id: '00000000-0000-4000-c000-000000000003',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-13'),
    caption: 'Sunset, right on schedule.',
    locationId: locations[2].id,
    mediaCount: 1,
  },
  {
    id: '00000000-0000-4000-c000-000000000004',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-14'),
    caption: null,
    locationId: locations[3].id,
    mediaCount: 4,
  },
  {
    id: '00000000-0000-4000-c000-000000000005',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-15'),
    caption: 'Took the early train out to Sintra to beat the crowds.',
    locationId: locations[4].id,
    mediaCount: 3,
  },
  {
    // Custom location (no Mapbox place), so it shows on the post but not the map
    id: '00000000-0000-4000-c000-000000000006',
    tripId: trips[0].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-09-16'),
    caption: 'Last dinner at the tiny place around the corner from our Airbnb.',
    customLocationName: "Tia Rosa's kitchen",
    mediaCount: 1,
  },
  {
    id: '00000000-0000-4000-c000-000000000007',
    tripId: trips[1].id,
    ownerId: 'user_seed_maya',
    visitedOn: new Date('2026-08-22'),
    caption: 'Port tasting by the river',
    customLocationName: 'Vila Nova de Gaia riverside',
    mediaCount: 1,
  },
  {
    id: '00000000-0000-4000-c000-000000000008',
    tripId: trips[2].id,
    ownerId: 'user_seed_priya',
    visitedOn: new Date('2026-09-25'),
    caption: 'Obligatory Nyhavn photo.',
    locationId: locations[5].id,
    mediaCount: 2,
  },
  {
    id: '00000000-0000-4000-c000-000000000009',
    tripId: trips[2].id,
    ownerId: 'user_seed_priya',
    visitedOn: new Date('2026-09-26'),
    caption: 'Smørrebrød for lunch, every day.',
    locationId: locations[7].id,
    mediaCount: 3,
  },
  {
    id: '00000000-0000-4000-c000-000000000010',
    tripId: trips[2].id,
    ownerId: 'user_seed_priya',
    visitedOn: new Date('2026-09-26'),
    caption: 'Tivoli at night is something else.',
    locationId: locations[6].id,
    mediaCount: 2,
  },
  {
    id: '00000000-0000-4000-c000-000000000011',
    tripId: trips[3].id,
    ownerId: 'user_seed_alex',
    visitedOn: daysFromToday(-1),
    caption: 'Made it up the hill before the fog rolled in.',
    locationId: locations[4].id,
    mediaCount: 2,
  },
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  for (const { id, ...location } of locations) {
    const data = { ...location, provider: 'mapbox' };
    await prisma.location.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  for (const { id, ...trip } of trips) {
    await prisma.trip.upsert({
      where: { id },
      update: trip,
      create: { id, ...trip },
    });
  }

  for (const [index, { id, ownerId, mediaCount, ...post }] of posts.entries()) {
    const data = {
      ...post,
      locationId: post.locationId ?? null,
      customLocationName: post.customLocationName ?? null,
    };
    await prisma.post.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });

    // Media IDs are d<post number>-<position>, e.g. ...-d001-000000000002
    const postNumber = String(index + 1).padStart(3, '0');
    for (let position = 0; position < mediaCount; position++) {
      const mediaId = `00000000-0000-4000-d${postNumber}-${String(position).padStart(12, '0')}`;
      const media = {
        postId: id,
        s3Key: `users/${ownerId}/posts/${mediaId}.jpg`,
        mediaType: 'image' as const,
        position,
        width: 1080,
        height: 1350,
      };
      await prisma.postMedia.upsert({
        where: { id: mediaId },
        update: media,
        create: { id: mediaId, ...media },
      });
    }
  }

  console.log(
    `Seeded ${users.length} users, ${locations.length} locations, ${trips.length} trips, ${posts.length} posts`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
