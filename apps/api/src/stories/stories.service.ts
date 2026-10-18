import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
  assertCursorInList,
  pageArgs,
  toPage,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import { canViewTrip, isActiveTrip, resolveToday } from '../trips/trip-rules';
import { lockTripForShare } from '../trips/trip-locks';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoriesFeedQueryDto } from './dto/stories-feed-query.dto';
import {
  StoriesFeedResponse,
  StoryGroup,
  StoryLocationResponse,
  StoryResponse,
  TripStoriesResponse,
} from './story.types';

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
const TRIP_STORY_ORDER = [
  { storyDate: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.StoryOrderByWithRelationInput[];

type FeedCursor = { latest: Date; ownerId: string };

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
    // The day the story is from (defaults to today). Without a trip it's
    // always today; with one it's checked against the trip's dates below.
    const storyDate = dto.storyDate ? parseDateOnly(dto.storyDate) : today;
    if (storyDate > today) {
      throw new BadRequestException("storyDate can't be in the future");
    }
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
    query: StoriesFeedQueryDto,
  ): Promise<StoriesFeedResponse> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const cursor = query.cursor ? decodeFeedCursor(query.cursor) : null;

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
        cursor
          ? Prisma.sql`HAVING (max(created_at), owner_id) < (${cursor.latest}::timestamp(3), ${cursor.ownerId})`
          : Prisma.empty
      }
      ORDER BY latest DESC, owner_id DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = owners.length > limit;
    const pageOwners = hasMore ? owners.slice(0, limit) : owners;
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
        owner: toUserSummary(ownerStories[0].owner),
        stories: await Promise.all(ownerStories.map((s) => this.toResponse(s))),
      });
    }

    const last = pageOwners[pageOwners.length - 1];
    return {
      items,
      nextCursor: hasMore
        ? encodeFeedCursor({ latest: last.latest, ownerId: last.owner_id })
        : null,
    };
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

    const where = { tripId, keepOnTrip: true } satisfies Prisma.StoryWhereInput;
    await assertCursorInList(query, (cursor) =>
      this.prisma.story.findFirst({
        where: { ...where, id: cursor },
        select: { id: true },
      }),
    );

    const stories = await this.prisma.story.findMany({
      where,
      include: storyInclude,
      orderBy: TRIP_STORY_ORDER,
      ...pageArgs(query),
    });

    return toPage(stories, query, (s) => this.toResponse(s));
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
      owner: toUserSummary(story.owner),
      tripId: story.tripId,
      text: story.text,
      location: story.location ? toLocationResponse(story.location) : null,
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

function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.latest.toISOString(), cursor.ownerId]),
  ).toString('base64url');
}

export function decodeFeedCursor(value: string): FeedCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      const latest = new Date(parsed[0]);
      if (!Number.isNaN(latest.getTime())) {
        return { latest, ownerId: parsed[1] };
      }
    }
  } catch {
    // Falls through to the error below
  }
  throw new BadRequestException('Invalid cursor');
}

function toLocationResponse(location: Location): StoryLocationResponse {
  return {
    id: location.id,
    provider: location.provider,
    providerPlaceId: location.providerPlaceId,
    name: location.name,
    address: location.address,
    latitude: location.latitude.toNumber(),
    longitude: location.longitude.toNumber(),
    city: location.city,
    region: location.region,
    countryCode: location.countryCode,
  };
}
