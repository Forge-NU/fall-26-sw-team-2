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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PaginationQueryDto } from '../common/pagination';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoriesFeedQueryDto } from './dto/stories-feed-query.dto';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('api')
@UseGuards(ClerkAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post('stories')
  create(@Req() request: AuthedRequest, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(request.user.userId, dto);
  }

  @Get('stories/feed')
  listFeed(@Query() query: StoriesFeedQueryDto) {
    return this.storiesService.listFeed(query);
  }

  @Delete('stories/:id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.storiesService.remove(request.user.userId, id);
  }

  @Get('trips/:id/stories')
  listForTrip(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.storiesService.listForTrip(request.user.userId, id, query);
  }
}
