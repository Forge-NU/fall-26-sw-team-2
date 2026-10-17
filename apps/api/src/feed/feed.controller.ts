import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  OptionalClerkAuthGuard,
  ViewerId,
} from '../auth/optional-clerk-auth.guard';
import { FypQueryDto } from './dto/fyp-query.dto';
import type { FeedPage } from './feed.types';
import { FypFeedService } from './fyp/fyp-feed.service';

@Controller('api/feed')
export class FeedController {
  constructor(private readonly fypFeed: FypFeedService) {}

  // Signed-out viewers get the FYP too; signing in only personalizes it.
  @Get('fyp')
  @UseGuards(OptionalClerkAuthGuard)
  getFyp(
    @ViewerId() viewerId: string | null,
    @Query() query: FypQueryDto,
  ): Promise<FeedPage> {
    return this.fypFeed.getPage({ viewerId, now: new Date() }, query);
  }
}
