import { Test } from '@nestjs/testing';
import { FeedController } from './feed.controller';
import { FeedModule } from './feed.module';
import { CandidateSource } from './feed.types';
import { FYP_SOURCES } from './fyp/fyp.config';

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
    builder.overrideProvider(FYP_SOURCES).useValue(sources);
  }
  const moduleRef = await builder.compile();
  return moduleRef.get(FeedController);
}

describe('FeedController', () => {
  it('returns an empty FYP feed until sources are registered', async () => {
    const controller = await buildController();

    await expect(
      controller.getFyp(undefined, undefined, undefined),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });

  it('ranks the FYP feed for the viewer in the x-user-id header', async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getFyp('viewer-1', undefined, undefined);

    expect(page.items.map((item) => item.itineraryId)).toEqual(['theirs']);
  });

  it('serves signed-out viewers', async () => {
    const controller = await buildController([testSource]);

    const page = await controller.getFyp(undefined, undefined, undefined);

    expect(page.items).toHaveLength(2);
  });
});
