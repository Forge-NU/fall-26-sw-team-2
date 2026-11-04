import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  SearchItems,
  SearchPage,
  SearchPreview,
  SearchResponse,
  SearchType,
} from 'shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { PostsService } from '../posts/posts.service';
import { visibleTripWhere } from '../trips/trip-rules';
import { SearchQueryDto, assertSearchQuery } from './dto/search-query.dto';
import {
  buildSearchPage,
  decodeSearchCursor,
  searchScope,
} from './search-cursor';
import { buildSearchSql } from './search-query';

const TYPES = ['people', 'places', 'trips', 'posts'] as const;
type RankedRow = { id: string; key: string };

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly posts: PostsService,
  ) {}

  async search(
    viewerId: string,
    query: SearchQueryDto,
  ): Promise<SearchResponse> {
    assertSearchQuery(query);
    if (query.type) return this.page(viewerId, query.type, query);
    const pages = await Promise.all(
      TYPES.map((type) => this.page(viewerId, type, { ...query, limit: 3 })),
    );
    return Object.fromEntries(
      TYPES.map((type, i) => [type, pages[i].items]),
    ) as SearchPreview;
  }

  private async ratingsReady(): Promise<boolean> {
    const [row] = await this.prisma.$queryRaw<{ ready: boolean }[]>`
      SELECT count(*) = 2 AS ready FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'locations'
      AND column_name IN ('rating_count', 'rating_sum')`;
    return row.ready;
  }

  async page<K extends SearchType>(
    viewerId: string,
    type: K,
    query: SearchQueryDto,
  ): Promise<SearchPage<K>> {
    const scope = searchScope([
      viewerId,
      type,
      query.q,
      query.sort ?? 'relevance',
      query.from ?? null,
      query.to ?? null,
      query.minRating ?? null,
      query.lat ?? null,
      query.lng ?? null,
      query.radiusKm ?? null,
    ]);
    const cursor = query.cursor
      ? decodeSearchCursor(query.cursor, scope)
      : undefined;
    if ([...query.q].length < 2) return { items: [], nextCursor: null };
    const usesRatings =
      type === 'places' || (type === 'posts' && query.minRating !== undefined);
    const ratingsReady = usesRatings && (await this.ratingsReady());
    if (
      (type === 'places' || type === 'posts') &&
      query.minRating !== undefined &&
      !ratingsReady
    ) {
      throw new ServiceUnavailableException(
        'Rating search requires RATE-1 (#91) to be deployed',
      );
    }
    const limit = query.limit ?? 20;
    // Search is stricter than ordinary visibility: even the viewer's own drafts
    // stay out. Reuse the published branch of the shared visibility rule.
    const published = visibleTripWhere(viewerId).OR?.find(
      (branch) => branch.status === 'published',
    );
    if (!published || published.status !== 'published')
      throw new Error('Published trip visibility rule is missing');
    const rows = await this.prisma.$queryRaw<RankedRow[]>(
      buildSearchSql(type, query, published.status, limit + 1, cursor),
    );
    const items = await Promise.all(
      rows
        .slice(0, limit)
        .map((row) =>
          this.toItem(viewerId, type, row.id, Boolean(ratingsReady)),
        ),
    );
    return buildSearchPage(rows, limit, items, (row) => ({ ...row, scope }));
  }

  private async toItem<K extends SearchType>(
    viewerId: string,
    type: K,
    id: string,
    ratingsReady: boolean,
  ): Promise<SearchItems[K]> {
    let item: SearchItems[SearchType];
    if (type === 'people') {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarUrl: true,
        },
      });
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: id },
        },
      });
      item = { ...user, isFollowing: Boolean(follow) };
    } else if (type === 'trips') item = await this.trips.findOne(viewerId, id);
    else if (type === 'posts') item = await this.posts.findOne(viewerId, id);
    else {
      const place = await this.prisma.location.findUniqueOrThrow({
        where: { id },
      });
      const postCount = await this.prisma.post.count({
        where: {
          locationId: id,
          trip: { AND: [visibleTripWhere(viewerId), { status: 'published' }] },
        },
      });
      let placeRating: { average: number; count: number } | null = null;
      if (ratingsReady) {
        const [totals] = await this.prisma.$queryRaw<
          { count: number; average: number | null }[]
        >`SELECT rating_count AS count, round(rating_sum::numeric / NULLIF(rating_count, 0), 1)::float8 AS average FROM locations WHERE id = ${id}::uuid`;
        if (totals.count > 0 && totals.average !== null)
          placeRating = { average: totals.average, count: totals.count };
      }
      item = {
        id: place.id,
        provider: place.provider,
        providerPlaceId: place.providerPlaceId,
        name: place.name,
        address: place.address,
        latitude: place.latitude.toNumber(),
        longitude: place.longitude.toNumber(),
        city: place.city,
        region: place.region,
        countryCode: place.countryCode,
        postCount,
        rating: placeRating,
      };
    }
    return item as SearchItems[K];
  }
}
