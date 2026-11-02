import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { StoriesCleanupService } from './stories-cleanup.service';

// Kept separate from StoriesModule so the scheduled task (cleanup.main.ts)
// starts only what it needs: no HTTP server, no Clerk.
@Module({
  imports: [PrismaModule, StorageModule],
  providers: [StoriesCleanupService],
  exports: [StoriesCleanupService],
})
export class StoriesCleanupModule {}
