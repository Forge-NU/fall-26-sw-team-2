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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PaginationQueryDto } from '../common/pagination';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('api')
@UseGuards(ClerkAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('posts')
  create(@Req() request: AuthedRequest, @Body() dto: CreatePostDto) {
    return this.postsService.create(request.user.userId, dto);
  }

  @Get('trips/:id/posts')
  listForTrip(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) tripId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postsService.listForTrip(request.user.userId, tripId, query);
  }

  @Get('posts/:id')
  findOne(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.findOne(request.user.userId, id);
  }

  @Patch('posts/:id')
  update(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(request.user.userId, id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.postsService.remove(request.user.userId, id);
  }
}
