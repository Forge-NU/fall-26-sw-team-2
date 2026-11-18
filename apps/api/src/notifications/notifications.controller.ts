import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { NotificationsService } from './notifications.service';

@Controller('me/notifications')
@UseGuards(ClerkAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.notificationsService.list(userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  // The app calls this when the inbox opens
  @Post('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
