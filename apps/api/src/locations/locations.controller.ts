import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResolveLocationDto } from './dto/resolve-location.dto';
import type {
  ResolveLocationRequest,
  ResolveLocationResponse,
} from 'shared-types';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // 200 whether the row was created or already existed; the client doesn't
  // need to tell them apart. A pin always creates a row, still 200 so every
  // kind answers the same way.
  @Post('resolve')
  @HttpCode(200)
  @UseGuards(ClerkAuthGuard)
  resolve(
    @CurrentUser() userId: string,
    @Body() dto: ResolveLocationDto,
  ): Promise<ResolveLocationResponse> {
    // The ValidationPipe has checked that the body matches one of the union's shapes
    return this.locationsService.resolve(userId, dto as ResolveLocationRequest);
  }
}
