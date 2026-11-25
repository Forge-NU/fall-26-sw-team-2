import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SavesService } from './saves.service';

// GET /api/me/saved/trips and /api/me/saved/posts are in TripsController and
// PostsController.
@Controller()
@UseGuards(ClerkAuthGuard)
export class SavesController {
  constructor(private readonly savesService: SavesService) {}

  @Post('trips/:id/save')
  @HttpCode(200)
  saveTrip(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savesService.saveTrip(userId, id);
  }

  @Delete('trips/:id/save')
  unsaveTrip(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savesService.unsaveTrip(userId, id);
  }

  @Post('posts/:id/save')
  @HttpCode(200)
  savePost(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savesService.savePost(userId, id);
  }

  @Delete('posts/:id/save')
  unsavePost(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.savesService.unsavePost(userId, id);
  }
}
