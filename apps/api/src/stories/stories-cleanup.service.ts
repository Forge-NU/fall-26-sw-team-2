import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

// Matches the S3 DeleteObjects limit, so each batch is one S3 request
export const CLEANUP_BATCH_SIZE = 1000;

// Deletes expired stories that weren't kept on a trip, then their S3
// objects. Run on a schedule by cleanup.main.ts (docs/architecture/stories.md).
// Reads already hide expired stories, so this only frees the space.
@Injectable()
export class StoriesCleanupService {
  private readonly logger = new Logger(StoriesCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Returns how many stories were deleted. Safe to run twice at once:
  // SKIP LOCKED means two runs never pick the same rows.
  async deleteExpired(batchSize = CLEANUP_BATCH_SIZE): Promise<number> {
    let deleted = 0;

    for (;;) {
      const rows = await this.prisma.$queryRaw<{ s3_key: string }[]>`
        DELETE FROM stories
        WHERE id IN (
          SELECT id FROM stories
          WHERE NOT keep_on_trip AND expires_at <= now()
          ORDER BY expires_at
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING s3_key
      `;
      if (rows.length === 0) break;

      deleted += rows.length;
      // After the rows are gone. Never throws: S3 failures are logged, and
      // the objects are left as orphans to sweep later.
      await this.storage.deleteObjects(rows.map((r) => r.s3_key));

      if (rows.length < batchSize) break;
    }

    this.logger.log(`Deleted ${deleted} expired stories`);
    return deleted;
  }
}
