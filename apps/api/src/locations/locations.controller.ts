import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ResolveLocationDto } from './dto/resolve-location.dto';
import {
  ResolveLocationRequest,
  ResolveLocationResponse,
} from './location.types';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // 200 whether the row was created or already existed; the client doesn't
  // need to tell them apart.
  @Post('resolve')
  @HttpCode(200)
  @UseGuards(ClerkAuthGuard)
  resolve(@Body() dto: ResolveLocationDto): Promise<ResolveLocationResponse> {
    // The ValidationPipe has checked that the body matches one of the union's shapes
    return this.locationsService.resolve(dto as ResolveLocationRequest);
  }
}
