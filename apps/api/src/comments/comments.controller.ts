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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller()
@UseGuards(ClerkAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:id/comments')
  create(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(userId, postId, dto);
  }

  @Get('posts/:id/comments')
  listForPost(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.listForPost(userId, postId, query);
  }

  @Get('comments/:id/replies')
  listReplies(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.listReplies(userId, id, query);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.commentsService.remove(userId, id);
  }
}
