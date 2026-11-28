import { Injectable } from '@nestjs/common';
import { Prisma, Trip } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PaginationQueryDto,
  buildPage,
  keyset,
  pageLimit,
} from '../common/pagination';
import { FeedRankingPage, FeedRankingService } from './feed-ranking.service';

type FeedRow = Pick<Trip, 'id' | 'publishedAt'>;

// Newest publish first. publishedAt is nullable in the schema, but a check
// constraint sets it exactly when status = 'published', and only published
// trips are queried, so it's never null here.
//
// Because the cursor holds the last trip's (publishedAt, id), a trip published
// mid-scroll sorts above it and can't repeat or shift later pages, and posts
// added after publishing don't move a trip.
const FRIENDS_FEED = keyset<
  FeedRow,
  Prisma.TripWhereInput,
  Prisma.TripOrderByWithRelationInput
>([
  { field: 'publishedAt', direction: 'desc', type: 'date' },
  { field: 'id', direction: 'desc', type: 'uuid' },
]);

// The MVP Friends feed: published trips owned by people the viewer follows.
// Trips they only collaborate on aren't included (joined trips don't show on
// a profile either, see docs/architecture/shared-trips.md).
@Injectable()
export class ChronologicalFeedRanking extends FeedRankingService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async rank(
    viewerId: string,
    query: PaginationQueryDto,
  ): Promise<FeedRankingPage> {
    // The viewer is in the list name, so one user's cursor is a 400 for another
    const list = `feed:friends:${viewerId}`;
    const limit = pageLimit(query);
    const rows = await this.prisma.trip.findMany({
      where: {
        status: 'published',
        owner: { followers: { some: { followerId: viewerId } } },
        ...FRIENDS_FEED.after(FRIENDS_FEED.decode(query.cursor, list)),
      },
      orderBy: FRIENDS_FEED.orderBy,
      select: { id: true, publishedAt: true },
      take: limit + 1,
    });

    const page = buildPage(rows, limit, (row) =>
      FRIENDS_FEED.cursor(list, row),
    );
    return {
      tripIds: page.items.map((row) => row.id),
      nextCursor: page.nextCursor,
    };
  }
}
