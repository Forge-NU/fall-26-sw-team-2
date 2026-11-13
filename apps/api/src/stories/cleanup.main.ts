import { NestFactory } from '@nestjs/core';
import { StoriesCleanupModule } from './stories-cleanup.module';
import { StoriesCleanupService } from './stories-cleanup.service';

// Entry point for the expired-story cleanup, which also deletes unused pins
// (#94 LOC-2). In AWS, an EventBridge Scheduler rule runs it hourly as a
// one-off ECS Fargate task from the API image (`node dist/stories/cleanup.main`).
// Locally: `npm run stories:cleanup:dev`. See docs/architecture/stories.md.
async function run() {
  const app = await NestFactory.createApplicationContext(StoriesCleanupModule);
  try {
    const cleanup = app.get(StoriesCleanupService);
    // Stories first: an expired story's pin goes with it
    await cleanup.deleteExpired();
    await cleanup.deleteUnusedPins();
  } finally {
    await app.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
