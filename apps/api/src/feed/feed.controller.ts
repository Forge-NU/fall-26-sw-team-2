import { Controller, Get, Headers, ParseIntPipe, Query } from '@nestjs/common';
import { FeedPage } from './feed.types';
import { FypFeedService } from './fyp/fyp-feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly fypFeed: FypFeedService) {}

  // TODO(auth): read the viewer from the authenticated user. The header is a stand-in
  // and can be spoofed, so don't rely on it for anything beyond personalization.
  @Get('fyp')
  getFyp(
    @Headers('x-user-id') viewerId: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit: number | undefined,
  ): Promise<FeedPage> {
    return this.fypFeed.getPage(
      { viewerId: viewerId ?? null, now: new Date() },
      { cursor, limit },
    );
  }
}
