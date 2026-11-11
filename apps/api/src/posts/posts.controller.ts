import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller()
@UseGuards(ClerkAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('posts')
  create(@CurrentUser() userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  // The current user's saved posts. There's no route for anyone else's.
  @Get('me/saved/posts')
  listSaved(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.postsService.listSaved(userId, query);
  }

  @Get('trips/:id/posts')
  listForTrip(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) tripId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postsService.listForTrip(userId, tripId, query);
  }

  @Get('posts/:id')
  findOne(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.findOne(userId, id);
  }

  @Patch('posts/:id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(userId, id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.postsService.remove(userId, id);
  }
}
