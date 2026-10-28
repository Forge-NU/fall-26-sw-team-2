import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { SearchResponse } from 'shared-types';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(ClerkAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser() userId: string,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponse> {
    return this.searchService.search(userId, query);
  }
}
