import { Test } from '@nestjs/testing';
import type { TripResponse } from '../trips/trip.types';
import { FeedController } from './feed.controller';
import { FeedModule } from './feed.module';
import type { CandidateSource, FeedCardLoader, FeedPage } from './feed.types';
import { FYP_CARD_LOADER, FYP_SOURCES } from './fyp/fyp.config';

const testSource: CandidateSource = {
  name: 'test',
  fetch: () =>
    Promise.resolve([
      { tripId: 'mine', authorId: 'viewer-1', publishedAt: new Date() },
      {
        tripId: 'theirs',
        authorId: 'someone-else',
        publishedAt: new Date(),
      },
    ]),
};

const testCardLoader: FeedCardLoader = {
  load: (tripIds) =>
    Promise.resolve(
      new Map(
        tripIds.map((id) => [id, { trip: { id } as TripResponse, posts: [] }]),
      ),
    ),
};

async function buildController(
  sources: CandidateSource[] = [],
): Promise<FeedController> {
  const moduleRef = await Test.createTestingModule({ imports: [FeedModule] })
    .overrideProvider(FYP_SOURCES)
    .useValue(sources)
    .overrideProvider(FYP_CARD_LOADER)
    .useValue(testCardLoader)
    .compile();
  return moduleRef.get(FeedController);
}

function ids(page: FeedPage): string[] {
  return page.items.map((item) => item.trip.id);
}

describe('FeedController', () => {
  it('returns an empty page when no sources find anything', async () => {
    const controller = await buildController();

    await expect(controller.getFyp(null, {})).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("leaves out the signed-in viewer's own trips", async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getFyp('viewer-1', {});

    expect(ids(page)).toEqual(['theirs']);
  });

  it('pages through the feed with the cursor', async () => {
    const controller = await buildController([testSource]);

    const first = await controller.getFyp(null, { limit: 1 });
    const second = await controller.getFyp(null, {
      limit: 1,
      cursor: first.nextCursor!,
    });

    expect([...ids(first), ...ids(second)].sort()).toEqual(['mine', 'theirs']);
    expect(second.nextCursor).toBeNull();
  });
});
