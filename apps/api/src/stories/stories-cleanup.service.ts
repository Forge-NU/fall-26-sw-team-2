import { Injectable, Logger } from '@nestjs/common';
import { UNUSED_PIN_LIFETIME_HOURS } from '../locations/custom-locations';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

// Matches the S3 DeleteObjects limit, so each batch is one S3 request
export const CLEANUP_BATCH_SIZE = 1000;

// Deletes expired stories that weren't kept on a trip, then their S3
// objects. Run on a schedule by cleanup.main.ts (docs/architecture/stories.md).
// Reads already hide expired stories, so this only frees the space.
// The same run deletes dropped pins (#94 LOC-2) that nobody attached to a
// post or story.
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

  // Deletes pins older than UNUSED_PIN_LIFETIME_HOURS that no post or story
  // uses: the composer was abandoned, or the post failed and its draft was
  // discarded. Attached pins are deleted with their post or story by the
  // delete_unused_custom_location trigger, so this never sees them. Returns
  // how many were deleted.
  //
  // SKIP LOCKED skips a pin a post is being written with (that write holds a
  // lock on the row), and a post can't attach a pin while this holds its lock.
  async deleteUnusedPins(batchSize = CLEANUP_BATCH_SIZE): Promise<number> {
    let deleted = 0;

    for (;;) {
      const count = await this.prisma.$executeRaw`
        DELETE FROM locations
        WHERE id IN (
          SELECT l.id FROM locations l
          WHERE l.provider = 'custom'
            AND l.created_at <= now() - make_interval(hours => ${UNUSED_PIN_LIFETIME_HOURS})
            AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.location_id = l.id)
            AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.location_id = l.id)
          ORDER BY l.created_at
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
      `;
      deleted += count;
      if (count < batchSize) break;
    }

    this.logger.log(`Deleted ${deleted} unused pins`);
    return deleted;
  }
}
