import type { PostResponse } from '../posts/post.types';
import type { PostsService } from '../posts/posts.service';
import type { TripResponse } from '../trips/trip.types';
import type { TripsService } from '../trips/trips.service';
import { TripCardLoader } from './trip-card.loader';

describe('TripCardLoader', () => {
  const trip = { id: 'trip-1' } as TripResponse;
  const post = { id: 'post-1', tripId: 'trip-1' } as PostResponse;
  const trips = { findPublishedByIds: jest.fn() };
  const posts = { listForTrips: jest.fn() };
  const loader = new TripCardLoader(
    trips as unknown as TripsService,
    posts as unknown as PostsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pairs each published trip with its posts, skipping trips not found', async () => {
    trips.findPublishedByIds.mockResolvedValue([trip]);
    posts.listForTrips.mockResolvedValue(new Map([['trip-1', [post]]]));

    const cards = await loader.load(['trip-1', 'deleted-trip']);

    expect([...cards.entries()]).toEqual([['trip-1', { trip, posts: [post] }]]);
    // Posts are only loaded for trips that came back published
    expect(posts.listForTrips).toHaveBeenCalledWith(['trip-1']);
  });

  it('gives a trip without posts an empty list', async () => {
    trips.findPublishedByIds.mockResolvedValue([trip]);
    posts.listForTrips.mockResolvedValue(new Map());

    const cards = await loader.load(['trip-1']);

    expect(cards.get('trip-1')).toEqual({ trip, posts: [] });
  });
});
