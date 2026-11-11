import { Injectable } from '@nestjs/common';
import type {
  SearchItems,
  SearchPage,
  SearchPerson,
  SearchPlace,
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

import { toLocation } from '../locations/locations.service';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { StorageService } from '../storage/storage.service';

const TYPES = ['people', 'places', 'trips', 'posts'] as const;
type RankedRow = { id: string; key: string };

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly posts: PostsService,
    private readonly storage: StorageService,
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
    const ranked = rows.slice(0, limit).map((row) => row.id);
    const loaded = await this.load(viewerId, type, ranked);
    // Keep the SQL's ranking. A row deleted between ranking and loading is
    // skipped; the cursor still comes from the ranked rows, so paging is fine.
    const items = ranked.flatMap((id) => loaded.get(id) ?? []);
    return buildSearchPage(rows, limit, items, (row) => ({ ...row, scope }));
  }

  // Loads the ranked ids with a fixed number of queries per type, however
  // many rows the page has. Ids that no longer exist are missing from the map.
  private async load<K extends SearchType>(
    viewerId: string,
    type: K,
    ids: string[],
  ): Promise<Map<string, SearchItems[K]>> {
    if (ids.length === 0) return new Map();
    let items: Map<string, SearchItems[SearchType]>;
    if (type === 'people') items = await this.loadPeople(viewerId, ids);
    else if (type === 'places') items = await this.loadPlaces(viewerId, ids);
    else if (type === 'trips')
      items = await this.trips.findManyForViewer(viewerId, ids);
    else items = await this.posts.findManyForViewer(viewerId, ids);
    return items as Map<string, SearchItems[K]>;
  }

  private async loadPeople(
    viewerId: string,
    ids: string[],
  ): Promise<Map<string, SearchPerson>> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        ...userSummarySelect,
        _count: { select: { followers: true, following: true } },
        followers: {
          where: { followerId: viewerId },
          select: { followerId: true },
          take: 1,
        },
      },
    });
    const people = await Promise.all(
      users.map(async ({ _count, followers, ...user }) => ({
        ...(await toUserSummary(user, this.storage)),
        followerCount: _count.followers,
        followingCount: _count.following,
        isFollowing: followers.length > 0,
      })),
    );
    return new Map(people.map((person) => [person.id, person]));
  }

  private async loadPlaces(
    viewerId: string,
    ids: string[],
  ): Promise<Map<string, SearchPlace>> {
    const [places, counts] = await Promise.all([
      this.prisma.location.findMany({ where: { id: { in: ids } } }),
      this.prisma.post.groupBy({
        by: ['locationId'],
        where: {
          locationId: { in: ids },
          trip: { AND: [visibleTripWhere(viewerId), { status: 'published' }] },
        },
        _count: { _all: true },
      }),
    ]);
    const postCounts = new Map(
      counts.map((row) => [row.locationId, row._count._all]),
    );
    return new Map(
      places.map((place) => [
        place.id,
        { ...toLocation(place), postCount: postCounts.get(place.id) ?? 0 },
      ]),
    );
  }
}
