import { Injectable } from '@nestjs/common';
import { PostsService } from '../posts/posts.service';
import { TripsService } from '../trips/trips.service';
import type { FeedCardLoader, TripCard } from './feed.types';

// Builds cards from the same response shapes as the trip and post endpoints.
@Injectable()
export class TripCardLoader implements FeedCardLoader {
  constructor(
    private readonly trips: TripsService,
    private readonly posts: PostsService,
  ) {}

  async load(tripIds: readonly string[]): Promise<Map<string, TripCard>> {
    const trips = await this.trips.findPublishedByIds(tripIds);
    // Posts are loaded only for trips that came back published, so drafts never leak.
    const postsByTrip = await this.posts.listForTrips(
      trips.map((trip) => trip.id),
    );

    return new Map(
      trips.map((trip) => [
        trip.id,
        { trip, posts: postsByTrip.get(trip.id) ?? [] },
      ]),
    );
  }
}
