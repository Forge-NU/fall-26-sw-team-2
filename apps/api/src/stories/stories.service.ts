import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Story } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  PaginationQueryDto,
  buildPage,
  decodeCursor,
  encodeCursor,
  keyset,
  pageLimit,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import { toLocation } from '../locations/locations.service';
import { canViewTrip, isActiveTrip, resolveToday } from '../trips/trip-rules';
import { lockTripForShare } from '../trips/trip-locks';
import { CreateStoryDto } from './dto/create-story.dto';
import type {
  StoriesFeedResponse,
  StoryGroup,
  StoryResponse,
  TripStoriesResponse,
} from 'shared-types';

const storyInclude = {
  owner: { select: userSummarySelect },
  location: true,
} satisfies Prisma.StoryInclude;

type StoryWithDetails = Prisma.StoryGetPayload<{
  include: typeof storyInclude;
}>;

// Oldest first, the order a viewer taps through them
const STORY_ORDER = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.StoryOrderByWithRelationInput[];

// Trip page order: by story date, then the order they were posted
const TRIP_STORIES = keyset<
  Story,
  Prisma.StoryWhereInput,
  Prisma.StoryOrderByWithRelationInput
>([
  { field: 'storyDate', direction: 'asc', type: 'date' },
  { field: 'createdAt', direction: 'asc', type: 'date' },
  { field: 'id', direction: 'asc', type: 'string' },
]);

// The feed pages through users, ordered by (latest story, owner id), both
// descending. It's a GROUP BY in SQL, so it uses the cursor directly rather
// than keyset().
const FEED_CURSOR_TYPES = ['date', 'string'] as const;

// Matches the expires_at default in the migration
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateStoryDto): Promise<StoryResponse> {
    if (dto.locationId != null && dto.customLocationName != null) {
      throw new BadRequestException(
        'Send at most one of locationId and customLocationName',
      );
    }
    if (dto.keepOnTrip && !dto.tripId) {
      throw new BadRequestException('keepOnTrip needs a tripId');
    }
    assertStoryKey(userId, dto.s3Key);
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }
    const today = resolveToday(dto.date);
    const tripId = dto.tripId;
    // The day the story is from, defaulting to today. With a trip it can be
    // any day of the trip (checked below); without one it's always today.
    const storyDate = dto.storyDate ? parseDateOnly(dto.storyDate) : today;
    if (!tripId && storyDate.getTime() !== today.getTime()) {
      throw new BadRequestException(
        'Without a trip, storyDate has to be today',
      );
    }

    const story = await withStoryKeyCheck(() =>
      this.prisma.$transaction(async (tx) => {
        if (tripId) {
          // Locked so the trip can't be published or deleted, or its dates
          // changed, between the active check and the insert
          await lockTripForShare(tx, tripId);
          const trip = await tx.trip.findUnique({ where: { id: tripId } });
          if (!trip || !canViewTrip(userId, trip)) {
            throw new NotFoundException('Trip not found');
          }
          if (trip.ownerId !== userId) {
            throw new ForbiddenException(
              'Stories can only be linked to your own trips',
            );
          }
          if (!isActiveTrip(trip, today)) {
            throw new BadRequestException(
              'Stories can only be linked to an active trip (a draft, with today within its dates)',
            );
          }
          if (storyDate < trip.startDate || storyDate > trip.endDate) {
            throw new BadRequestException(
              "storyDate must be within the trip's dates",
            );
          }
        }

        // Both times come from the database's clock, the one reads compare
        // expires_at against, so a story lives exactly 24 hours. (Prisma
        // would fill createdAt from this server's clock.)
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT now()`;
        return tx.story.create({
          data: {
            createdAt: now,
            expiresAt: new Date(now.getTime() + STORY_LIFETIME_MS),
            storyDate,
            ownerId: userId,
            tripId: tripId ?? null,
            s3Key: dto.s3Key,
            text: dto.text || null,
            locationId: dto.locationId ?? null,
            customLocationName: dto.customLocationName ?? null,
            keepOnTrip: dto.keepOnTrip ?? false,
          },
          include: storyInclude,
        });
      }),
    );

    return this.toResponse(story);
  }

  // Owner only. Anyone else gets 404, the same as a story that doesn't exist.
  async remove(userId: string, id: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id },
      select: { ownerId: true, s3Key: true },
    });
    if (!story || story.ownerId !== userId) {
      throw new NotFoundException('Story not found');
    }

    // If the cleanup job got to it first, it deletes the S3 object too
    const { count } = await this.prisma.story.deleteMany({ where: { id } });
    if (count > 0) {
      // Never throws: S3 failures are logged, and the delete still succeeds
      await this.storage.deleteObjects([story.s3Key]);
    }
  }

  // The stories bar: the viewer and the users they follow who have active
  // stories, the most recent first, each with their active stories oldest
  // first. Pages through users.
  async listFeed(
    viewerId: string,
    query: PaginationQueryDto,
  ): Promise<StoriesFeedResponse> {
    const limit = pageLimit(query);
    const list = `stories-feed:${viewerId}`;
    const after = decodeCursor(query.cursor, list, FEED_CURSOR_TYPES) as
      [Date, string] | undefined;

    // Compared with the database's clock, the same one that set expires_at
    const owners = await this.prisma.$queryRaw<
      { owner_id: string; latest: Date; now: Date }[]
    >`
      SELECT owner_id, max(created_at) AS latest, now() AS now
      FROM stories
      WHERE expires_at > now()
        AND (
          owner_id = ${viewerId}
          OR owner_id IN (
            SELECT following_id FROM follows WHERE follower_id = ${viewerId}
          )
        )
      GROUP BY owner_id
      ${
        after
          ? Prisma.sql`HAVING (max(created_at), owner_id) < (${after[0]}::timestamp(3), ${after[1]})`
          : Prisma.empty
      }
      ORDER BY latest DESC, owner_id DESC
      LIMIT ${limit + 1}
    `;

    const { items: pageOwners, nextCursor } = buildPage(owners, limit, (o) =>
      encodeCursor(list, [o.latest, o.owner_id]),
    );
    if (pageOwners.length === 0) {
      return { items: [], nextCursor: null };
    }

    const stories = await this.prisma.story.findMany({
      where: {
        ownerId: { in: pageOwners.map((o) => o.owner_id) },
        expiresAt: { gt: pageOwners[0].now },
      },
      include: storyInclude,
      orderBy: STORY_ORDER,
    });

    const byOwner = new Map<string, StoryWithDetails[]>();
    for (const story of stories) {
      const list = byOwner.get(story.ownerId) ?? [];
      list.push(story);
      byOwner.set(story.ownerId, list);
    }

    const items: StoryGroup[] = [];
    for (const { owner_id } of pageOwners) {
      // A user's last story can expire between the two queries
      const ownerStories = byOwner.get(owner_id);
      if (!ownerStories) continue;
      items.push({
        owner: await toUserSummary(ownerStories[0].owner, this.storage),
        stories: await Promise.all(ownerStories.map((s) => this.toResponse(s))),
      });
    }

    return { items, nextCursor };
  }

  // Stories kept on a trip ("Add to trip"), including after they expire, in
  // story date order. Visible to whoever can see the trip.
  async listForTrip(
    viewerId: string,
    tripId: string,
    query: PaginationQueryDto,
  ): Promise<TripStoriesResponse> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true, status: true },
    });
    if (!trip || !canViewTrip(viewerId, trip)) {
      throw new NotFoundException('Trip not found');
    }

    const list = `trip-stories:${tripId}`;
    const limit = pageLimit(query);
    const stories = await this.prisma.story.findMany({
      where: {
        tripId,
        keepOnTrip: true,
        ...TRIP_STORIES.after(TRIP_STORIES.decode(query.cursor, list)),
      },
      include: storyInclude,
      orderBy: TRIP_STORIES.orderBy,
      take: limit + 1,
    });

    const page = buildPage(stories, limit, (s) => TRIP_STORIES.cursor(list, s));
    return {
      items: await Promise.all(page.items.map((s) => this.toResponse(s))),
      nextCursor: page.nextCursor,
    };
  }

  private async assertLocationExists(locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException('Location not found');
    }
  }

  private async toResponse(story: StoryWithDetails): Promise<StoryResponse> {
    return {
      id: story.id,
      owner: await toUserSummary(story.owner, this.storage),
      tripId: story.tripId,
      text: story.text,
      location: story.location ? toLocation(story.location) : null,
      customLocationName: story.customLocationName,
      imageUrl: await this.storage.getReadUrl(story.s3Key),
      keepOnTrip: story.keepOnTrip,
      storyDate: formatDateOnly(story.storyDate),
      expiresAt: story.expiresAt.toISOString(),
      createdAt: story.createdAt.toISOString(),
    };
  }
}

// Keys come from the upload endpoint (#38), which puts every story upload
// under users/{userId}/stories/. A key outside that prefix isn't this user's
// upload.
function assertStoryKey(userId: string, key: string) {
  const prefix = `users/${userId}/stories/`;
  if (
    !key.startsWith(prefix) ||
    key.length === prefix.length ||
    key.includes('..')
  ) {
    throw new BadRequestException(`Invalid media key: ${key}`);
  }
}

// Covers two requests using the same key at once
async function withStoryKeyCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new BadRequestException('Media key already in use');
    }
    throw e;
  }
}
