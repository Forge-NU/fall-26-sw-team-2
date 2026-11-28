import { Test } from '@nestjs/testing';
import type { PostResponse, TripResponse } from 'shared-types';
import { PostsService } from '../posts/posts.service';
import { TripsService } from '../trips/trips.service';
import { FeedRankingService } from './feed-ranking.service';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed-query.dto';

const viewerId = 'user_viewer';

const trip = (id: string) => ({ id }) as TripResponse;
const post = (id: string, tripId: string) => ({ id, tripId }) as PostResponse;

function query(fields: Partial<FeedQueryDto> = {}): FeedQueryDto {
  return Object.assign(new FeedQueryDto(), fields);
}

describe('FeedService', () => {
  let service: FeedService;

  // Stands in for any ranking: the service only sees the interface
  const ranking = { rank: jest.fn() };
  const trips = { findManyForViewer: jest.fn() };
  const posts = { listCardPostsForTrips: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: FeedRankingService, useValue: ranking },
        { provide: TripsService, useValue: trips },
        { provide: PostsService, useValue: posts },
      ],
    }).compile();
    service = module.get(FeedService);
  });

  it('defaults to the friends feed', () => {
    expect(new FeedQueryDto().type).toBe('friends');
  });

  it('returns an empty page for local without ranking anything', async () => {
    await expect(
      service.getFeed(viewerId, query({ type: 'local' })),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(ranking.rank).not.toHaveBeenCalled();
  });

  it("builds cards in the ranking's order, whatever the ranking is", async () => {
    ranking.rank.mockResolvedValue({
      tripIds: ['b', 'a'],
      nextCursor: 'next',
    });
    trips.findManyForViewer.mockResolvedValue(
      new Map([
        ['a', trip('a')],
        ['b', trip('b')],
      ]),
    );
    posts.listCardPostsForTrips.mockResolvedValue(
      new Map([['a', [post('p1', 'a'), post('p2', 'a')]]]),
    );

    const q = query({ limit: 2, cursor: 'abc' });
    await expect(service.getFeed(viewerId, q)).resolves.toEqual({
      items: [
        { trip: trip('b'), posts: [] },
        { trip: trip('a'), posts: [post('p1', 'a'), post('p2', 'a')] },
      ],
      nextCursor: 'next',
    });
    expect(ranking.rank).toHaveBeenCalledWith(viewerId, q);
    expect(trips.findManyForViewer).toHaveBeenCalledWith(viewerId, ['b', 'a']);
    expect(posts.listCardPostsForTrips).toHaveBeenCalledWith(viewerId, [
      'b',
      'a',
    ]);
  });

  it("drops trips the viewer can't see instead of failing", async () => {
    ranking.rank.mockResolvedValue({
      tripIds: ['gone', 'a'],
      nextCursor: null,
    });
    trips.findManyForViewer.mockResolvedValue(new Map([['a', trip('a')]]));
    posts.listCardPostsForTrips.mockResolvedValue(new Map());

    await expect(service.getFeed(viewerId, query())).resolves.toEqual({
      items: [{ trip: trip('a'), posts: [] }],
      nextCursor: null,
    });
  });

  it('returns an empty page when the ranking has nothing', async () => {
    ranking.rank.mockResolvedValue({ tripIds: [], nextCursor: null });
    trips.findManyForViewer.mockResolvedValue(new Map());
    posts.listCardPostsForTrips.mockResolvedValue(new Map());

    await expect(service.getFeed(viewerId, query())).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
