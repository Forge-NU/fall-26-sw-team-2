import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { CandidateFilter, CandidateSource, SignalHydrator } from './feed.types';
import { FypFeedService } from './fyp/fyp-feed.service';
import {
  DEFAULT_FYP_CONFIG,
  FYP_CONFIG,
  FYP_FILTERS,
  FYP_HYDRATORS,
  FYP_RERANKER,
  FYP_SCORER,
  FYP_SOURCES,
} from './fyp/fyp.config';
import { AuthorDiversityReranker } from './stages/author-diversity.reranker';
import { ExcludeOwnItinerariesFilter } from './stages/exclude-own-itineraries.filter';
import { RecencyHydrator } from './stages/recency.hydrator';
import { WeightedSignalScorer } from './stages/weighted-signal.scorer';

@Module({
  controllers: [FeedController],
  providers: [
    { provide: FYP_CONFIG, useValue: DEFAULT_FYP_CONFIG },

    // TODO(ingest): register CandidateSource implementations here once itinerary data
    // exists. Until then the FYP feed is always empty.
    { provide: FYP_SOURCES, useValue: [] satisfies CandidateSource[] },

    // TODO(ingest): add hydrators for engagement, quality, tasteMatch and community.
    RecencyHydrator,
    {
      provide: FYP_HYDRATORS,
      useFactory: (recency: RecencyHydrator): SignalHydrator[] => [recency],
      inject: [RecencyHydrator],
    },

    ExcludeOwnItinerariesFilter,
    {
      provide: FYP_FILTERS,
      useFactory: (
        ownItineraries: ExcludeOwnItinerariesFilter,
      ): CandidateFilter[] => [ownItineraries],
      inject: [ExcludeOwnItinerariesFilter],
    },

    { provide: FYP_SCORER, useClass: WeightedSignalScorer },
    { provide: FYP_RERANKER, useClass: AuthorDiversityReranker },
    FypFeedService,
  ],
})
export class FeedModule {}
