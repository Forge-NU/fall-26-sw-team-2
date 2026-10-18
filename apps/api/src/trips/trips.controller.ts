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
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { ActiveTripsQueryDto } from './dto/active-trips-query.dto';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('api')
@UseGuards(ClerkAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('trips')
  create(@Req() request: AuthedRequest, @Body() dto: CreateTripDto) {
    return this.tripsService.create(request.user.userId, dto);
  }

  @Get('me/trips/active')
  listActive(
    @Req() request: AuthedRequest,
    @Query() query: ActiveTripsQueryDto,
  ) {
    return this.tripsService.listActive(request.user.userId, query.date);
  }

  @Get('users/:userId/trips')
  listForUser(
    @Req() request: AuthedRequest,
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tripsService.listForUser(request.user.userId, userId, query);
  }

  @Get('trips/:id')
  findOne(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.findOne(request.user.userId, id);
  }

  @Patch('trips/:id')
  update(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(request.user.userId, id, dto);
  }

  @Delete('trips/:id')
  @HttpCode(204)
  async remove(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tripsService.remove(request.user.userId, id);
  }

  @Post('trips/:id/publish')
  @HttpCode(200)
  publish(
    @Req() request: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.publish(request.user.userId, id);
  }
}
