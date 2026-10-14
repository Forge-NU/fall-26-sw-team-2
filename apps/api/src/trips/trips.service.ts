import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Trip } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import {
  Page,
  PaginationQueryDto,
  assertCursorInList,
  pageArgs,
  toPage,
} from '../common/pagination';
import { toUserSummary, userSummarySelect } from '../common/user-summary';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { activeTripWhere, canViewTrip, resolveToday } from './trip-rules';
import { lockTripForUpdate } from './trip-locks';
import { ActiveTripsResponse, TripResponse } from './trip.types';

// Trip order for posts: by date, then the order they were added.
export const POST_ORDER = [
  { visitedOn: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.PostOrderByWithRelationInput[];

const tripInclude = {
  owner: { select: userSummarySelect },
  _count: { select: { posts: true } },
  // Cover image: the first photo of the first post
  posts: {
    orderBy: POST_ORDER,
    take: 1,
    select: {
      media: {
        where: { mediaType: 'image' },
        orderBy: { position: 'asc' },
        take: 1,
        select: { s3Key: true },
      },
    },
  },
} satisfies Prisma.TripInclude;

type TripWithDetails = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(ownerId: string, dto: CreateTripDto): Promise<TripResponse> {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    assertDateOrder(startDate, endDate);

    const trip = await this.prisma.trip.create({
      data: {
        ownerId,
        title: dto.title,
        destination: dto.destination,
        description: dto.description || null,
        startDate,
        endDate,
      },
      include: tripInclude,
    });

    return this.toResponse(trip);
  }

  async findOne(viewerId: string, id: string): Promise<TripResponse> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: tripInclude,
    });

    if (!trip || !canViewTrip(viewerId, trip)) {
      throw new NotFoundException('Trip not found');
    }

    return this.toResponse(trip);
  }

  // Loads a trip the user wants to change. A trip they can't see is a 404, so
  // drafts don't leak; one they can see but don't own is a 403.
  async getOwnedTrip(userId: string, id: string): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });

    if (!trip || !canViewTrip(userId, trip)) {
      throw new NotFoundException('Trip not found');
    }
    if (trip.ownerId !== userId) {
      throw new ForbiddenException('Only the trip owner can do this');
    }

    return trip;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTripDto,
  ): Promise<TripResponse> {
    await this.getOwnedTrip(userId, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Locked so a post can't be added outside the new dates while we check
      await lockTripForUpdate(tx, id);
      const trip = await tx.trip.findUnique({ where: { id } });
      if (!trip) {
        throw new NotFoundException('Trip not found');
      }

      const startDate = dto.startDate
        ? parseDateOnly(dto.startDate)
        : trip.startDate;
      const endDate = dto.endDate ? parseDateOnly(dto.endDate) : trip.endDate;
      assertDateOrder(startDate, endDate);

      if (dto.startDate || dto.endDate) {
        const postsOutside = await tx.post.count({
          where: {
            tripId: id,
            OR: [
              { visitedOn: { lt: startDate } },
              { visitedOn: { gt: endDate } },
            ],
          },
        });
        if (postsOutside > 0) {
          throw new BadRequestException(
            `The new dates would leave ${postsOutside} post(s) outside the trip`,
          );
        }
      }

      return tx.trip.update({
        where: { id },
        data: {
          title: dto.title,
          destination: dto.destination,
          description:
            dto.description === undefined ? undefined : dto.description || null,
          startDate: dto.startDate ? startDate : undefined,
          endDate: dto.endDate ? endDate : undefined,
        },
        include: tripInclude,
      });
    });

    return this.toResponse(updated);
  }

  // Hard delete. Posts and media rows cascade; their S3 objects are deleted
  // after the rows are gone.
  async remove(userId: string, id: string): Promise<void> {
    await this.getOwnedTrip(userId, id);

    const keys = await this.prisma.$transaction(async (tx) => {
      // Locked so no post is added between reading the keys and deleting
      await lockTripForUpdate(tx, id);
      const media = await tx.postMedia.findMany({
        where: { post: { tripId: id } },
        select: { s3Key: true },
      });
      await tx.trip.deleteMany({ where: { id } });
      return media.map((m) => m.s3Key);
    });

    await this.storage.deleteObjects(keys);
  }

  // Publishing can't be undone. Publishing a published trip is a no-op.
  async publish(userId: string, id: string): Promise<TripResponse> {
    await this.getOwnedTrip(userId, id);

    const published = await this.prisma.$transaction(async (tx) => {
      // Locked so the last post can't be deleted while we publish, and two
      // publishes at once don't both set publishedAt
      await lockTripForUpdate(tx, id);
      const trip = await tx.trip.findUnique({
        where: { id },
        include: tripInclude,
      });
      if (!trip) {
        throw new NotFoundException('Trip not found');
      }
      if (trip.status === 'published') {
        return trip;
      }

      if (trip._count.posts === 0) {
        throw new BadRequestException(
          'A trip needs at least one post before it can be published',
        );
      }

      return tx.trip.update({
        where: { id },
        data: { status: 'published', publishedAt: new Date() },
        include: tripInclude,
      });
    });

    return this.toResponse(published);
  }

  // A user's trips for their profile, newest first. Drafts are only included
  // on your own profile.
  async listForUser(
    viewerId: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Page<TripResponse>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const where: Prisma.TripWhereInput = {
      ownerId: userId,
      ...(viewerId === userId ? {} : { status: 'published' }),
    };
    await assertCursorInList(query, (cursor) =>
      this.prisma.trip.findFirst({
        where: { id: cursor, ...where },
        select: { id: true },
      }),
    );

    const trips = await this.prisma.trip.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      include: tripInclude,
      ...pageArgs(query),
    });

    return toPage(trips, query, (trip) => this.toResponse(trip));
  }

  async listActive(
    ownerId: string,
    date?: string,
  ): Promise<ActiveTripsResponse> {
    const today = resolveToday(date);

    const trips = await this.prisma.trip.findMany({
      where: activeTripWhere(ownerId, today),
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: tripInclude,
    });

    return { items: await Promise.all(trips.map((t) => this.toResponse(t))) };
  }

  private async toResponse(trip: TripWithDetails): Promise<TripResponse> {
    const coverKey = trip.posts[0]?.media[0]?.s3Key;

    return {
      id: trip.id,
      owner: toUserSummary(trip.owner),
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      startDate: formatDateOnly(trip.startDate),
      endDate: formatDateOnly(trip.endDate),
      status: trip.status,
      publishedAt: trip.publishedAt?.toISOString() ?? null,
      postCount: trip._count.posts,
      coverImageUrl: coverKey ? await this.storage.getReadUrl(coverKey) : null,
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    };
  }
}

function assertDateOrder(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    throw new BadRequestException("endDate can't be before startDate");
  }
}
