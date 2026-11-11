import type { SearchPreview } from 'shared-types';

// Deterministic public content with dates, ratings and distances on both sides
// of the filter thresholds. More than one page exists for every result type.
export function createSearchFixtures(): SearchPreview {
  const people = Array.from({ length: 36 }, (_, i) => ({
    id: `search-user-${i}`, firstName: ['Maya', 'Alex', 'Priya'][i % 3],
    lastName: `Lisbon Traveler ${i + 1}`, username: `lisbon.traveler.${i + 1}`,
    avatarUrl: null, followerCount: 0, followingCount: 0, isFollowing: i % 4 === 0,
  }));
  const places = people.map((_, i) => ({
    id: `search-place-${i}`, name: `${['Lisbon viewpoint', 'Lisbon café', 'Lisbon gardens'][i % 3]} ${i + 1}`,
    latitude: 38.707 + (i % 6) * 0.035, longitude: -9.136 + (i % 4) * 0.03,
    provider: 'mapbox', providerPlaceId: `mock-mapbox-${i}`, address: null,
    city: 'Lisbon', region: 'Lisbon', countryCode: 'PT', postCount: 1,
    rating: i % 5 === 0 ? null : { average: [3, 3.5, 4, 4.5, 5][i % 5], count: 1 },
  }));
  const trips = people.map((owner, i) => {
    const month = i % 2 === 0 ? '06' : '09';
    const createdAt = `2026-${month}-${String(i % 27 + 1).padStart(2, '0')}T12:00:00.000Z`;
    return {
      id: `search-trip-${i}`, owner, title: `${['A weekend in Lisbon', 'Lisbon food walk', 'Lisbon viewpoints'][i % 3]} ${i + 1}`,
      destination: 'Lisbon, Portugal', description: 'Tram rides, tiled streets and sunset by the river.',
      startDate: `2026-${month}-10`, endDate: `2026-${month}-14`, status: 'published' as const,
      publishedAt: createdAt, postCount: 1, coverImageUrl: null, createdAt, updatedAt: createdAt,
    };
  });
  const posts = trips.map((trip, i) => ({
    id: `search-post-${i}`, tripId: trip.id, author: trip.owner,
    caption: `A slow afternoon at ${places[i].name}. Worth the walk!`, visitedOn: trip.startDate,
    location: {
      id: places[i].id, provider: 'mapbox', providerPlaceId: `mock-mapbox-${i}`,
      name: places[i].name, address: null, latitude: places[i].latitude, longitude: places[i].longitude,
      rating: places[i].rating,
      city: 'Lisbon', region: 'Lisbon', countryCode: 'PT',
    },
    rating: null, customLocationName: null, media: [], createdAt: trip.createdAt, updatedAt: trip.updatedAt,
  }));
  return { people, places, trips, posts };
}
