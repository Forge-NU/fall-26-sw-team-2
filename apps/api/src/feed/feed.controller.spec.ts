import { Test } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedModule } from './feed.module';
import type { CandidateSource, FeedPage } from './feed.types';
import { FYP_SOURCES } from './fyp/fyp.config';

const testSource: CandidateSource = {
  name: 'test',
  fetch: () =>
    Promise.resolve([
      { itineraryId: 'mine', authorId: 'viewer-1', createdAt: new Date() },
      {
        itineraryId: 'theirs',
        authorId: 'someone-else',
        createdAt: new Date(),
      },
    ]),
};

async function buildController(
  sources?: CandidateSource[],
): Promise<FeedController> {
  const builder = Test.createTestingModule({ imports: [FeedModule] });
  if (sources) {
    builder.overrideProvider(FYP_SOURCES).useValue(sources);
  }
  const moduleRef = await builder.compile();
  return moduleRef.get(FeedController);
}

function ids(page: FeedPage): string[] {
  return page.items.map((item) => item.itineraryId);
}

describe('FeedController', () => {
  it('returns an empty FYP until sources are registered', async () => {
    const controller = await buildController();

    await expect(
      controller.getFyp(undefined, undefined, undefined),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("leaves out the viewer's own itineraries", async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getFyp('viewer-1', undefined, undefined);

    expect(ids(page)).toEqual(['theirs']);
  });

  it('pages through the feed with the cursor', async () => {
    const controller = await buildController([testSource]);

    const first = await controller.getFyp(undefined, undefined, 1);
    const second = await controller.getFyp(undefined, first.nextCursor!, 1);

    expect([...ids(first), ...ids(second)].sort()).toEqual(['mine', 'theirs']);
    expect(second.nextCursor).toBeNull();
  });
});
