import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TripsModule } from '../trips/trips.module';
import { PostsModule } from '../posts/posts.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [PrismaModule, TripsModule, PostsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
