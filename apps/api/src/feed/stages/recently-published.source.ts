import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CandidateSource,
  SourcedCandidate,
  ViewerContext,
} from '../feed.types';

// The most recently published trips. The only source until we add smarter ones
// (popular, same school, matches taste). Drafts never appear.
@Injectable()
export class RecentlyPublishedSource implements CandidateSource {
  readonly name = 'recently-published';

  constructor(private readonly prisma: PrismaService) {}

  async fetch(
    _viewer: ViewerContext,
    limit: number,
  ): Promise<SourcedCandidate[]> {
    const trips = await this.prisma.trip.findMany({
      where: { status: 'published' },
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, ownerId: true, publishedAt: true, createdAt: true },
    });

    return trips.map((trip) => ({
      tripId: trip.id,
      authorId: trip.ownerId,
      // Always set on published trips; the fallback is only for the type.
      publishedAt: trip.publishedAt ?? trip.createdAt,
    }));
  }
}
