import {
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InvitesService } from './invites.service';

// POST /api/trips/:id/invites, GET /api/trips/:id/invites and
// DELETE /api/invites/:id (cancel) come with the rest of #134 COLLAB-3.
@Controller('invites')
@UseGuards(ClerkAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitesService.accept(userId, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitesService.decline(userId, id);
  }
}
