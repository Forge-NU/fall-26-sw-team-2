import {
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
import { LikesService } from './likes.service';
import { LikesQueryDto } from './dto/likes-query.dto';

@Controller('posts/:id')
@UseGuards(ClerkAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('like')
  @HttpCode(200)
  like(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.likesService.like(userId, id);
  }

  @Delete('like')
  unlike(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.likesService.unlike(userId, id);
  }

  @Get('likes')
  listLikers(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LikesQueryDto,
  ) {
    return this.likesService.listLikers(userId, id, query);
  }
}
