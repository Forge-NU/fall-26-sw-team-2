import { Injectable } from '@nestjs/common';
import type { FeedItem, FeedResponse } from 'shared-types';
import { PostsService } from '../posts/posts.service';
import { TripsService } from '../trips/trips.service';
import { FeedRankingService } from './feed-ranking.service';
import { FeedQueryDto } from './dto/feed-query.dto';

// The home feed (#26 FEED-1): the ranking picks the trips, this builds the
// cards. A page takes four queries however many cards it has: the ranking,
// the trips, and two for the posts the cards' day previews use.
@Injectable()
export class FeedService {
  constructor(
    private readonly ranking: FeedRankingService,
    private readonly trips: TripsService,
    private readonly posts: PostsService,
  ) {}

  async getFeed(viewerId: string, query: FeedQueryDto): Promise<FeedResponse> {
    // Local is post-MVP (docs/product/mvp-decisions.md)
    if (query.type === 'local') return { items: [], nextCursor: null };

    const { tripIds, nextCursor } = await this.ranking.rank(viewerId, query);
    const [trips, postsByTrip] = await Promise.all([
      this.trips.findManyForViewer(viewerId, tripIds),
      this.posts.listCardPostsForTrips(viewerId, tripIds),
    ]);

    // In the ranking's order. A trip deleted since ranking isn't in `trips`,
    // so it's dropped rather than failing the page. findManyForViewer only
    // checks that the viewer can see a trip, not that they follow its owner:
    // keeping the Friends feed to follows is the ranking's job.
    const items: FeedItem[] = [];
    for (const id of tripIds) {
      const trip = trips.get(id);
      if (trip) items.push({ trip, posts: postsByTrip.get(id) ?? [] });
    }
    return { items, nextCursor };
  }
}
