import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { CandidateFilter, CandidateSource, SignalHydrator } from './feed.types';
import { ForYouFeedService } from './for-you/for-you-feed.service';
import {
  DEFAULT_FOR_YOU_CONFIG,
  FOR_YOU_CONFIG,
  FOR_YOU_FILTERS,
  FOR_YOU_HYDRATORS,
  FOR_YOU_RERANKER,
  FOR_YOU_SCORER,
  FOR_YOU_SOURCES,
} from './for-you/for-you.config';
import { AuthorDiversityReranker } from './stages/author-diversity.reranker';
import { ExcludeOwnItinerariesFilter } from './stages/exclude-own-itineraries.filter';
import { RecencyHydrator } from './stages/recency.hydrator';
import { WeightedSignalScorer } from './stages/weighted-signal.scorer';

@Module({
  controllers: [FeedController],
  providers: [
    { provide: FOR_YOU_CONFIG, useValue: DEFAULT_FOR_YOU_CONFIG },

    // TODO(ingest): register CandidateSource implementations here once itinerary data
    // exists. Until then the For You feed is always empty.
    { provide: FOR_YOU_SOURCES, useValue: [] satisfies CandidateSource[] },

    // TODO(ingest): add hydrators for engagement, quality, tasteMatch and community.
    RecencyHydrator,
    {
      provide: FOR_YOU_HYDRATORS,
      useFactory: (recency: RecencyHydrator): SignalHydrator[] => [recency],
      inject: [RecencyHydrator],
    },

    ExcludeOwnItinerariesFilter,
    {
      provide: FOR_YOU_FILTERS,
      useFactory: (
        ownItineraries: ExcludeOwnItinerariesFilter,
      ): CandidateFilter[] => [ownItineraries],
      inject: [ExcludeOwnItinerariesFilter],
    },

    { provide: FOR_YOU_SCORER, useClass: WeightedSignalScorer },
    { provide: FOR_YOU_RERANKER, useClass: AuthorDiversityReranker },
    ForYouFeedService,
  ],
})
export class FeedModule {}
