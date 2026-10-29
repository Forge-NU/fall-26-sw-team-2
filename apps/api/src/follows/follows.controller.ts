import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { FollowsService } from './follows.service';
import { FollowListQueryDto } from './dto/follow-list-query.dto';

type AuthedRequest = Request & {
  user: { userId: string };
};

@Controller('users')
@UseGuards(ClerkAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get(':userId/followers')
  getFollowers(
    @Req() request: AuthedRequest,
    @Param('userId') userId: string,
    @Query() query: FollowListQueryDto,
  ) {
    return this.followsService.getFollowList(
      request.user.userId,
      userId,
      'followers',
      query,
    );
  }

  @Get(':userId/following')
  getFollowing(
    @Req() request: AuthedRequest,
    @Param('userId') userId: string,
    @Query() query: FollowListQueryDto,
  ) {
    return this.followsService.getFollowList(
      request.user.userId,
      userId,
      'following',
      query,
    );
  }

  @Post(':userId/follow')
  follow(@Req() request: AuthedRequest, @Param('userId') userId: string) {
    return this.followsService.follow(request.user.userId, userId);
  }

  @Delete(':userId/follow')
  @HttpCode(204)
  async unfollow(
    @Req() request: AuthedRequest,
    @Param('userId') userId: string,
  ) {
    await this.followsService.unfollow(request.user.userId, userId);
  }

  @Get(':userId/follow-status')
  getFollowStatus(
    @Req() request: AuthedRequest,
    @Param('userId') userId: string,
  ) {
    return this.followsService.getFollowStatus(request.user.userId, userId);
  }
}
