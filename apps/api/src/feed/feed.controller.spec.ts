import { Test } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedModule } from './feed.module';
import { CandidateSource } from './feed.types';
import { FOR_YOU_SOURCES } from './for-you/for-you.config';

const testSource: CandidateSource = {
  name: 'test',
  fetch: () =>
    Promise.resolve([
      {
        itineraryId: 'mine',
        authorId: 'viewer-1',
        createdAt: new Date(),
        signals: {},
      },
      {
        itineraryId: 'theirs',
        authorId: 'someone-else',
        createdAt: new Date(),
        signals: {},
      },
    ]),
};

async function buildController(
  sources?: CandidateSource[],
): Promise<FeedController> {
  const builder = Test.createTestingModule({ imports: [FeedModule] });
  if (sources) {
    builder.overrideProvider(FOR_YOU_SOURCES).useValue(sources);
  }
  const moduleRef = await builder.compile();
  return moduleRef.get(FeedController);
}

describe('FeedController', () => {
  it('returns an empty For You feed until sources are registered', async () => {
    const controller = await buildController();

    await expect(
      controller.getForYou(undefined, undefined, undefined),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('ranks the For You feed for the viewer in the x-user-id header', async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getForYou('viewer-1', undefined, undefined);

    expect(page.items.map((item) => item.itineraryId)).toEqual(['theirs']);
  });

  it('serves signed-out viewers', async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getForYou(undefined, undefined, undefined);

    expect(page.items).toHaveLength(2);
  });
});
