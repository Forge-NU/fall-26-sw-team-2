import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTripInviteDto } from './dto/create-trip-invite.dto';
import { InvitesService } from './invites.service';

// A trip's invites (#134 COLLAB-3). Owner only. Cancelling and answering one
// invite are in InvitesController, under /api/invites/:id.
@Controller('trips/:id/invites')
@UseGuards(ClerkAuthGuard)
export class TripInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateTripInviteDto,
  ) {
    return this.invitesService.create(userId, tripId, dto.username);
  }

  @Get()
  list(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) tripId: string,
  ) {
    return this.invitesService.listPending(userId, tripId);
  }
}
