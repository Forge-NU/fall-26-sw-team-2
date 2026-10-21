import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoriesFeedQueryDto } from './dto/stories-feed-query.dto';

@Controller()
@UseGuards(ClerkAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post('stories')
  create(@CurrentUser() userId: string, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(userId, dto);
  }

  @Get('stories/feed')
  listFeed(@CurrentUser() userId: string, @Query() query: StoriesFeedQueryDto) {
    return this.storiesService.listFeed(userId, query);
  }

  @Delete('stories/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.storiesService.remove(userId, id);
  }

  @Get('trips/:id/stories')
  listForTrip(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.storiesService.listForTrip(userId, id, query);
  }
}
