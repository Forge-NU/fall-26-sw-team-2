import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoriesCleanupModule } from './stories-cleanup.module';

@Module({
  imports: [PrismaModule, StorageModule, StoriesCleanupModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
