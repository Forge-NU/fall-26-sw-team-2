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
  pageArgs,
  toPage,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { POST_ORDER, TripsService } from '../trips/trips.service';
import { canViewTrip } from '../trips/trip-rules';
import { CreatePostDto } from './dto/create-post.dto';
import { MediaItemDto } from './dto/media-item.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { LocationResponse, PostResponse } from './post.types';

const postInclude = {
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
} satisfies Prisma.PostInclude;

type PostWithDetails = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tripsService: TripsService,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<PostResponse> {
    const trip = await this.tripsService.getOwnedTrip(userId, dto.tripId);

    const visitedOn = parseDateOnly(dto.visitedOn);
    assertWithinTrip(trip, visitedOn);

    if ((dto.locationId != null) === (dto.customLocationName != null)) {
      throw new BadRequestException(
        'Send exactly one of locationId and customLocationName',
      );
    }
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }

    await this.assertMediaKeys(userId, dto.media);

    const post = await this.withMediaKeyCheck(() =>
      this.prisma.post.create({
        data: {
          tripId: trip.id,
          visitedOn,
          caption: dto.caption || null,
          locationId: dto.locationId ?? null,
          customLocationName: dto.customLocationName ?? null,
          media: { create: toMediaRows(dto.media) },
        },
        include: postInclude,
      }),
    );

    return this.toResponse(post);
  }

  async findOne(viewerId: string, id: string): Promise<PostResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
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

    if (dto.visitedOn) {
      assertWithinTrip(post.trip, parseDateOnly(dto.visitedOn));
    }

    if (dto.locationId !== undefined && dto.customLocationName !== undefined) {
      throw new BadRequestException(
        'Send only one of locationId and customLocationName',
      );
    }
    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }

    let removedKeys: string[] = [];
    if (dto.media) {
      await this.assertMediaKeys(userId, dto.media, id);
      const newKeys = new Set(dto.media.map((m) => m.s3Key));
      removedKeys = post.media
        .map((m) => m.s3Key)
        .filter((key) => !newKeys.has(key));
    }

    const media = dto.media;
    const updated = await this.withMediaKeyCheck(() =>
      this.prisma.$transaction(async (tx) => {
        if (media) {
          await tx.postMedia.deleteMany({ where: { postId: id } });
        }

        return tx.post.update({
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
          },
          include: postInclude,
        });
      }),
    );

    await this.storage.deleteObjects(removedKeys);

    return this.toResponse(updated);
  }

  // Hard delete. Media rows cascade; their S3 objects are deleted after the
  // rows are gone.
  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedPost(userId, id);

    const keys = await this.prisma.$transaction(async (tx) => {
      const media = await tx.postMedia.findMany({
        where: { postId: id },
        select: { s3Key: true },
      });
      await tx.post.deleteMany({ where: { id } });
      return media.map((m) => m.s3Key);
    });

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

    const posts = await this.prisma.post.findMany({
      where: { tripId },
      orderBy: POST_ORDER,
      include: postInclude,
      ...pageArgs(query),
    });

    return toPage(posts, query, (post) => this.toResponse(post));
  }

  // Same rules as trips: 404 if the viewer can't see the post's trip, 403 if
  // they can but don't own it.
  private async getOwnedPost(userId: string, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
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
