import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TripsModule } from '../trips/trips.module';
import { FeedController } from './feed.controller';
import type {
  CandidateFilter,
  CandidateHydrator,
  CandidateScorer,
  CandidateSource,
  FeedSideEffect,
  ViewerHydrator,
} from './feed.types';
import { FypFeedService } from './fyp/fyp-feed.service';
import {
  DEFAULT_FYP_CONFIG,
  FYP_CANDIDATE_HYDRATORS,
  FYP_CARD_LOADER,
  FYP_CONFIG,
  FYP_FILTERS,
  FYP_SCORERS,
  FYP_SELECTOR,
  FYP_SIDE_EFFECTS,
  FYP_SOURCES,
  FYP_VIEWER_HYDRATORS,
} from './fyp/fyp.config';
import {
  InMemoryServedHistoryStore,
  SERVED_HISTORY_STORE,
} from './served-history.store';
import { AuthorDiversityScorer } from './stages/author-diversity.scorer';
import { EngagementRateScorer } from './stages/engagement-rate.scorer';
import { ExcludeOwnTripsFilter } from './stages/exclude-own-trips.filter';
import { PreviouslyServedFilter } from './stages/previously-served.filter';
import { RecencyScorer } from './stages/recency.scorer';
import { RecentlyPublishedSource } from './stages/recently-published.source';
import { ServedHistoryHydrator } from './stages/served-history.hydrator';
import { TopKSelector } from './stages/top-k.selector';
import { UpdateServedHistorySideEffect } from './stages/update-served-history.side-effect';
import { WeightedActionScorer } from './stages/weighted-action.scorer';
import { TripCardLoader } from './trip-card.loader';

@Module({
  imports: [PrismaModule, TripsModule, PostsModule],
  controllers: [FeedController],
  providers: [
    { provide: FYP_CONFIG, useValue: DEFAULT_FYP_CONFIG },
    { provide: SERVED_HISTORY_STORE, useClass: InMemoryServedHistoryStore },

    // TODO(ingest): add viewer hydrators for follows, blocks, saves and school.
    ServedHistoryHydrator,
    {
      provide: FYP_VIEWER_HYDRATORS,
      useFactory: (servedHistory: ServedHistoryHydrator): ViewerHydrator[] => [
        servedHistory,
      ],
      inject: [ServedHistoryHydrator],
    },

    // TODO(ingest): add sources for popular trips, same school and taste match.
    RecentlyPublishedSource,
    {
      provide: FYP_SOURCES,
      useFactory: (
        recentlyPublished: RecentlyPublishedSource,
      ): CandidateSource[] => [recentlyPublished],
      inject: [RecentlyPublishedSource],
    },

    // TODO(ingest): load engagement stats and author impressions onto candidates.
    {
      provide: FYP_CANDIDATE_HYDRATORS,
      useValue: [] satisfies CandidateHydrator[],
    },

    ExcludeOwnTripsFilter,
    PreviouslyServedFilter,
    {
      provide: FYP_FILTERS,
      useFactory: (
        ownTrips: ExcludeOwnTripsFilter,
        previouslyServed: PreviouslyServedFilter,
      ): CandidateFilter[] => [ownTrips, previouslyServed],
      inject: [ExcludeOwnTripsFilter, PreviouslyServedFilter],
    },

    // Order matters: predict actions, combine them, then adjust the combined score.
    EngagementRateScorer,
    WeightedActionScorer,
    RecencyScorer,
    AuthorDiversityScorer,
    {
      provide: FYP_SCORERS,
      useFactory: (
        engagementRate: EngagementRateScorer,
        weightedAction: WeightedActionScorer,
        recency: RecencyScorer,
        authorDiversity: AuthorDiversityScorer,
      ): CandidateScorer[] => [
        engagementRate,
        weightedAction,
        recency,
        authorDiversity,
      ],
      inject: [
        EngagementRateScorer,
        WeightedActionScorer,
        RecencyScorer,
        AuthorDiversityScorer,
      ],
    },

    { provide: FYP_SELECTOR, useClass: TopKSelector },

    UpdateServedHistorySideEffect,
    {
      provide: FYP_SIDE_EFFECTS,
      useFactory: (
        servedHistory: UpdateServedHistorySideEffect,
      ): FeedSideEffect[] => [servedHistory],
      inject: [UpdateServedHistorySideEffect],
    },

    { provide: FYP_CARD_LOADER, useClass: TripCardLoader },
    FypFeedService,
  ],
})
export class FeedModule {}
