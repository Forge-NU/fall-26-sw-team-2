import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Trip } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canViewTrip } from '../trips/trip-rules';
import { SaveStatusResponse } from './save.types';

// Saving and unsaving trips and posts. Both are idempotent. The Saved tab
// lists are in TripsService and PostsService, which build those responses.
@Injectable()
export class SavesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveTrip(userId: string, tripId: string): Promise<SaveStatusResponse> {
    await this.assertCanView(userId, 'Trip', this.tripOf(tripId));
    await insertIgnoringDuplicates('Trip', () =>
      this.prisma.tripSave.createMany({
        data: { userId, tripId },
        skipDuplicates: true,
      }),
    );
    return this.tripStatus(tripId, true);
  }

  async unsaveTrip(
    userId: string,
    tripId: string,
  ): Promise<SaveStatusResponse> {
    await this.assertCanView(userId, 'Trip', this.tripOf(tripId));
    await this.prisma.tripSave.deleteMany({ where: { userId, tripId } });
    return this.tripStatus(tripId, false);
  }

  async savePost(userId: string, postId: string): Promise<SaveStatusResponse> {
    await this.assertCanView(userId, 'Post', this.postTripOf(postId));
    await insertIgnoringDuplicates('Post', () =>
      this.prisma.postSave.createMany({
        data: { userId, postId },
        skipDuplicates: true,
      }),
    );
    return this.postStatus(postId, true);
  }

  async unsavePost(
    userId: string,
    postId: string,
  ): Promise<SaveStatusResponse> {
    await this.assertCanView(userId, 'Post', this.postTripOf(postId));
    await this.prisma.postSave.deleteMany({ where: { userId, postId } });
    return this.postStatus(postId, false);
  }

  private async tripStatus(tripId: string, saved: boolean) {
    const saveCount = await this.prisma.tripSave.count({ where: { tripId } });
    return { saved, saveCount };
  }

  private async postStatus(postId: string, saved: boolean) {
    const saveCount = await this.prisma.postSave.count({ where: { postId } });
    return { saved, saveCount };
  }

  private tripOf(tripId: string) {
    return this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { ownerId: true, status: true },
    });
  }

  // The trip a post is on, which decides who can see the post
  private async postTripOf(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { trip: { select: { ownerId: true, status: true } } },
    });
    return post?.trip ?? null;
  }

  // Something you can't see is a 404, same as reading it
  private async assertCanView(
    viewerId: string,
    kind: 'Trip' | 'Post',
    tripLookup: Promise<Pick<Trip, 'ownerId' | 'status'> | null>,
  ) {
    const trip = await tripLookup;
    if (!trip || !canViewTrip(viewerId, trip)) {
      throw new NotFoundException(`${kind} not found`);
    }
  }
}

// createMany with skipDuplicates is ON CONFLICT DO NOTHING, so saving twice
// (or two requests at once) keeps one row. A foreign key error means the trip
// or post was deleted after the visibility check.
async function insertIgnoringDuplicates(
  kind: 'Trip' | 'Post',
  insert: () => Promise<unknown>,
) {
  try {
    await insert();
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2003'
    ) {
      throw new NotFoundException(`${kind} not found`);
    }
    throw e;
  }
}
