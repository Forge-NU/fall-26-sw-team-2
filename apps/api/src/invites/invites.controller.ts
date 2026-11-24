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
import { InvitesService } from './invites.service';

// One invite (#134 COLLAB-3): the owner cancels it, the invitee answers it.
// Sending and listing a trip's invites are in TripInvitesController.
@Controller('invites')
@UseGuards(ClerkAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Delete(':id')
  cancel(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitesService.cancel(userId, id);
  }

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
