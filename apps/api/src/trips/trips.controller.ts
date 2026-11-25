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
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { ActiveTripsQueryDto } from './dto/active-trips-query.dto';

@Controller()
@UseGuards(ClerkAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('trips')
  create(@CurrentUser() userId: string, @Body() dto: CreateTripDto) {
    return this.tripsService.create(userId, dto);
  }

  @Get('me/trips/active')
  listActive(
    @CurrentUser() userId: string,
    @Query() query: ActiveTripsQueryDto,
  ) {
    return this.tripsService.listActive(userId, query.date);
  }

  // The current user's saved trips. There's no route for anyone else's.
  @Get('me/saved/trips')
  listSaved(@CurrentUser() userId: string, @Query() query: PaginationQueryDto) {
    return this.tripsService.listSaved(userId, query);
  }

  @Get('users/:userId/trips')
  listForUser(
    @CurrentUser() currentUserId: string,
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tripsService.listForUser(currentUserId, userId, query);
  }

  @Get('trips/:id')
  findOne(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.findOne(userId, id);
  }

  @Patch('trips/:id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(userId, id, dto);
  }

  @Delete('trips/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tripsService.remove(userId, id);
  }

  @Post('trips/:id/publish')
  @HttpCode(200)
  publish(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.publish(userId, id);
  }
}
