import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Location, Prisma, Trip } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import {
  Page,
  PaginationQueryDto,
  assertCursorInList,
  keyedPageArgs,
  pageArgs,
  toPage,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { POST_ORDER, TripsService } from '../trips/trips.service';
import { canViewTrip, visibleTripWhere } from '../trips/trip-rules';
import { lockTripForShare } from '../trips/trip-locks';
import { CreatePostDto } from './dto/create-post.dto';
import { MediaItemDto } from './dto/media-item.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { LocationResponse, PostResponse } from './post.types';

// `viewerId` is who's reading, for likedByMe and savedByMe. Each of those
// relations has at most one row for them (it's the primary key).
function postInclude(viewerId: string) {
  return {
    trip: {
      select: {
        ownerId: true,
        status: true,
        startDate: true,
        endDate: true,
        owner: { select: userSummarySelect },
      },
    },
    location: true,
    media: { orderBy: { position: 'asc' } },
    _count: { select: { likes: true, saves: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
    saves: { where: { userId: viewerId }, select: { userId: true } },
  } satisfies Prisma.PostInclude;
}

type PostWithDetails = Prisma.PostGetPayload<{
  include: ReturnType<typeof postInclude>;
}>;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tripsService: TripsService,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<PostResponse> {
    await this.tripsService.getOwnedTrip(userId, dto.tripId);

    if ((dto.locationId != null) === (dto.customLocationName != null)) {
      throw new BadRequestException(
        'Send exactly one of locationId and customLocationName',
      );
    }
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }

    assertMediaDurations(dto.media);
    await this.assertMediaKeys(userId, dto.media);

    const post = await this.withMediaKeyCheck(() =>
      this.prisma.$transaction(async (tx) => {
        // Locked so the trip's dates can't change, and the trip can't be
        // deleted, while the post goes in
        const trip = await this.lockedTrip(tx, dto.tripId);
        const visitedOn = parseDateOnly(dto.visitedOn);
        assertWithinTrip(trip, visitedOn);

        return tx.post.create({
          data: {
            tripId: trip.id,
            visitedOn,
            caption: dto.caption || null,
            locationId: dto.locationId ?? null,
            customLocationName: dto.customLocationName ?? null,
            media: { create: toMediaRows(dto.media) },
          },
          include: postInclude(userId),
        });
      }),
    );

    return this.toResponse(post);
  }

  async findOne(viewerId: string, id: string): Promise<PostResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude(viewerId),
    });

    if (!post || !canViewTrip(viewerId, post.trip)) {
      throw new NotFoundException('Post not found');
    }

    return this.toResponse(post);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdatePostDto,
  ): Promise<PostResponse> {
    const post = await this.getOwnedPost(userId, id);

    if (dto.locationId !== undefined && dto.customLocationName !== undefined) {
      throw new BadRequestException(
        'Send only one of locationId and customLocationName',
      );
    }
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }
    if (dto.media) {
      assertMediaDurations(dto.media);
      await this.assertMediaKeys(userId, dto.media, id);
    }

    const media = dto.media;
    const { updated, removedKeys } = await this.withMediaKeyCheck(() =>
      this.prisma.$transaction(async (tx) => {
        const trip = await this.lockedTrip(tx, post.tripId);
        if (dto.visitedOn) {
          assertWithinTrip(trip, parseDateOnly(dto.visitedOn));
        }

        // Locked so two edits to the same post's media run one at a time,
        // and the removed keys are worked out from what's actually there
        await tx.$queryRaw`SELECT id FROM posts WHERE id = ${id}::uuid FOR UPDATE`;
        let removedKeys: string[] = [];
        if (media) {
          const newKeys = new Set(media.map((m) => m.s3Key));
          const current = await tx.postMedia.findMany({
            where: { postId: id },
            select: { s3Key: true },
          });
          removedKeys = current
            .map((m) => m.s3Key)
            .filter((key) => !newKeys.has(key));
          await tx.postMedia.deleteMany({ where: { postId: id } });
        }

        const updated = await tx.post.update({
          where: { id },
          data: {
            visitedOn: dto.visitedOn ? parseDateOnly(dto.visitedOn) : undefined,
            caption:
              dto.caption === undefined ? undefined : dto.caption || null,
            ...(dto.locationId !== undefined && {
              locationId: dto.locationId,
              customLocationName: null,
            }),
            ...(dto.customLocationName !== undefined && {
              locationId: null,
              customLocationName: dto.customLocationName,
            }),
            ...(media && { media: { create: toMediaRows(media) } }),
            // Prisma doesn't bump @updatedAt for a media-only change
            updatedAt: new Date(),
          },
          include: postInclude(userId),
        });

        return { updated, removedKeys };
      }),
    );

    // Never throws: S3 failures are logged, and the edit still succeeds
    await this.storage.deleteObjects(removedKeys);

    return this.toResponse(updated);
  }

  // Hard delete. Media rows cascade; their S3 objects are deleted after the
  // rows are gone.
  async remove(userId: string, id: string): Promise<void> {
    const post = await this.getOwnedPost(userId, id);

    const keys = await this.prisma.$transaction(async (tx) => {
      // Locked so publishing can't count this post while it's being deleted
      await this.lockedTrip(tx, post.tripId);
      const media = await tx.postMedia.findMany({
        where: { postId: id },
        select: { s3Key: true },
      });
      await tx.post.deleteMany({ where: { id } });
      return media.map((m) => m.s3Key);
    });

    // Never throws: S3 failures are logged, and the delete still succeeds
    await this.storage.deleteObjects(keys);
  }

  // A trip's posts in trip order, for the trip page.
  async listForTrip(
    viewerId: string,
    tripId: string,
    query: PaginationQueryDto,
  ): Promise<Page<PostResponse>> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true, status: true },
    });
    if (!trip || !canViewTrip(viewerId, trip)) {
      throw new NotFoundException('Trip not found');
    }

    await assertCursorInList(query, (cursor) =>
      this.prisma.post.findFirst({
        where: { id: cursor, tripId },
        select: { id: true },
      }),
    );

    const posts = await this.prisma.post.findMany({
      where: { tripId },
      orderBy: POST_ORDER,
      include: postInclude(viewerId),
      ...pageArgs(query),
    });

    return toPage(posts, query, (post) => this.toResponse(post));
  }

  // The posts in the Saved tab, most recently saved first. Only ever the
  // current user's own saves. The cursor is a post ID.
  async listSaved(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Page<PostResponse>> {
    // Saves stay visible only while their trip is. Every saved post was
    // visible when saved, and publishing can't be undone, so this is a guard.
    const where: Prisma.PostSaveWhereInput = {
      userId,
      post: { trip: visibleTripWhere(userId) },
    };
    const key = (postId: string) => ({ userId_postId: { userId, postId } });
    await assertCursorInList(query, (cursor) =>
      this.prisma.postSave.findFirst({
        where: { ...where, postId: cursor },
        select: { postId: true },
      }),
    );

    const saves = await this.prisma.postSave.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      include: { post: { include: postInclude(userId) } },
      ...keyedPageArgs(query, key),
    });

    return toPage(
      saves,
      query,
      (save) => this.toResponse(save.post),
      (save) => save.postId,
    );
  }

  // Takes a share lock on the trip (see trip-locks.ts) and re-reads it, since
  // its dates may have changed since the ownership check.
  private async lockedTrip(tx: Prisma.TransactionClient, tripId: string) {
    await lockTripForShare(tx, tripId);
    const trip = await tx.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return trip;
  }

  // Same rules as trips: 404 if the viewer can't see the post's trip, 403 if
  // they can but don't own it.
  private async getOwnedPost(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude(userId),
    });

    if (!post || !canViewTrip(userId, post.trip)) {
      throw new NotFoundException('Post not found');
    }
    if (post.trip.ownerId !== userId) {
      throw new ForbiddenException('Only the trip owner can do this');
    }

    return post;
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

  // Keys come from the upload endpoint (#38), which puts every post upload
  // under users/{userId}/posts/. A key outside that prefix isn't this user's
  // upload. `postId` is the post being edited, whose own keys are allowed.
  private async assertMediaKeys(
    userId: string,
    media: MediaItemDto[],
    postId?: string,
  ) {
    const prefix = `users/${userId}/posts/`;
    const keys = media.map((m) => m.s3Key);

    for (const key of keys) {
      if (
        !key.startsWith(prefix) ||
        key.length === prefix.length ||
        key.includes('..')
      ) {
        throw new BadRequestException(`Invalid media key: ${key}`);
      }
    }

    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Each media key can only be used once');
    }

    const inUse = await this.prisma.postMedia.findMany({
      where: {
        s3Key: { in: keys },
        ...(postId && { postId: { not: postId } }),
      },
      select: { s3Key: true },
    });
    if (inUse.length > 0) {
      throw new BadRequestException(
        `Media key already in use: ${inUse.map((m) => m.s3Key).join(', ')}`,
      );
    }
  }

  // Covers the race where two requests use the same key at once.
  private async withMediaKeyCheck<T>(write: () => Promise<T>): Promise<T> {
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

  private async toResponse(post: PostWithDetails): Promise<PostResponse> {
    return {
      id: post.id,
      tripId: post.tripId,
      author: toUserSummary(post.trip.owner),
      caption: post.caption,
      visitedOn: formatDateOnly(post.visitedOn),
      location: post.location ? toLocationResponse(post.location) : null,
      customLocationName: post.customLocationName,
      media: await Promise.all(
        post.media.map(async (m) => ({
          id: m.id,
          mediaType: m.mediaType,
          url: await this.storage.getReadUrl(m.s3Key),
          width: m.width,
          height: m.height,
          durationMs: m.durationMs,
        })),
      ),
      likeCount: post._count.likes,
      saveCount: post._count.saves,
      commentCount: post._count.comments,
      likedByMe: post.likes.length > 0,
      savedByMe: post.saves.length > 0,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}

function assertWithinTrip(
  trip: Pick<Trip, 'startDate' | 'endDate'>,
  visitedOn: Date,
) {
  if (visitedOn < trip.startDate || visitedOn > trip.endDate) {
    throw new BadRequestException("visitedOn must be within the trip's dates");
  }
}

// Videos need a duration and images can't have one. Checked here rather than
// in the DTO since it depends on two fields.
function assertMediaDurations(media: MediaItemDto[]) {
  for (const item of media) {
    if (item.mediaType === 'video' && item.durationMs == null) {
      throw new BadRequestException('Videos need a durationMs');
    }
    if (item.mediaType === 'image' && item.durationMs != null) {
      throw new BadRequestException("Images can't have a durationMs");
    }
  }
}

function toMediaRows(media: MediaItemDto[]) {
  return media.map((m, position) => ({
    s3Key: m.s3Key,
    mediaType: m.mediaType,
    position,
    width: m.width ?? null,
    height: m.height ?? null,
    durationMs: m.durationMs ?? null,
  }));
}

function toLocationResponse(location: Location): LocationResponse {
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
