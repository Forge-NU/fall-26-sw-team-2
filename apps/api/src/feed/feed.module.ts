import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PostsModule } from '../posts/posts.module';
import { TripsModule } from '../trips/trips.module';
import { ChronologicalFeedRanking } from './chronological-feed-ranking';
import { FeedController } from './feed.controller';
import { FeedRankingService } from './feed-ranking.service';
import { FeedService } from './feed.service';

@Module({
  imports: [PrismaModule, TripsModule, PostsModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    // Swap the ranking here (#5); nothing else changes
    { provide: FeedRankingService, useClass: ChronologicalFeedRanking },
  ],
})
export class FeedModule {}
