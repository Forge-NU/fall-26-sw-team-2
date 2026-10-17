import { BadRequestException, Logger } from '@nestjs/common';
import type {
  CandidateHydrator,
  CandidateSource,
  EngagementStats,
  FeedCardLoader,
  FeedPage,
  SourcedCandidate,
  TripCard,
} from '../feed.types';
import { InMemoryServedHistoryStore } from '../served-history.store';
import type { TripResponse } from '../../trips/trip.types';
import { AuthorDiversityScorer } from '../stages/author-diversity.scorer';
import { EngagementRateScorer } from '../stages/engagement-rate.scorer';
import { ExcludeOwnTripsFilter } from '../stages/exclude-own-trips.filter';
import { PreviouslyServedFilter } from '../stages/previously-served.filter';
import { RecencyScorer } from '../stages/recency.scorer';
import { ServedHistoryHydrator } from '../stages/served-history.hydrator';
import { TopKSelector } from '../stages/top-k.selector';
import { UpdateServedHistorySideEffect } from '../stages/update-served-history.side-effect';
import { WeightedActionScorer } from '../stages/weighted-action.scorer';
import { DEFAULT_FYP_CONFIG } from './fyp.config';
import { FypFeedService } from './fyp-feed.service';

const now = new Date('2026-10-14T00:00:00Z');
const viewer = { viewerId: 'viewer-1', now };
const config = DEFAULT_FYP_CONFIG;

function candidate(
  tripId: string,
  overrides: Partial<SourcedCandidate> = {},
): SourcedCandidate {
  return {
    tripId,
    authorId: `author-${tripId}`,
    publishedAt: now,
    ...overrides,
  };
}

function saves(count: number): EngagementStats {
  return { impressions: 100, actions: { save: count } };
}

function sourceOf(
  name: string,
  candidates: SourcedCandidate[],
): CandidateSource {
  return { name, fetch: () => Promise.resolve(candidates) };
}

function card(tripId: string): TripCard {
  return { trip: { id: tripId } as TripResponse, posts: [] };
}

const loadEveryCard: FeedCardLoader = {
  load: (tripIds) =>
    Promise.resolve(new Map(tripIds.map((id) => [id, card(id)]))),
};

function buildService(
  sources: CandidateSource[],
  candidateHydrators: CandidateHydrator[] = [],
  cardLoader: FeedCardLoader = loadEveryCard,
): FypFeedService {
  const servedHistory = new InMemoryServedHistoryStore();
  return new FypFeedService(
    config,
    [new ServedHistoryHydrator(servedHistory)],
    sources,
    candidateHydrators,
    [new ExcludeOwnTripsFilter(), new PreviouslyServedFilter()],
    [
      new EngagementRateScorer(config),
      new WeightedActionScorer(config),
      new RecencyScorer(config),
      new AuthorDiversityScorer(config),
    ],
    new TopKSelector(config),
    [new UpdateServedHistorySideEffect(servedHistory)],
    cardLoader,
  );
}

function ids(page: FeedPage): string[] {
  return page.items.map((item) => item.trip.id);
}

describe('FypFeedService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty page when there are no sources', async () => {
    const page = await buildService([]).getPage(viewer);

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('returns each trip with its card, score and sources', async () => {
    const page = await buildService([
      sourceOf('test', [candidate('a')]),
    ]).getPage(viewer);

    expect(page.items).toEqual([
      { ...card('a'), score: expect.any(Number) as number, sources: ['test'] },
    ]);
  });

  it('drops a trip deleted between ranking and loading its card', async () => {
    const missingB: FeedCardLoader = {
      load: (tripIds) =>
        Promise.resolve(
          new Map(
            tripIds.filter((id) => id !== 'b').map((id) => [id, card(id)]),
          ),
        ),
    };
    const service = buildService(
      [sourceOf('test', [candidate('a'), candidate('b')])],
      [],
      missingB,
    );

    expect(ids(await service.getPage(viewer))).toEqual(['a']);
  });

  it('ranks by predicted actions, with negative actions pulling items down', async () => {
    const service = buildService([
      sourceOf('test', [
        candidate('often-hidden', {
          stats: { impressions: 100, actions: { hide: 30 } },
        }),
        candidate('no-data'),
        candidate('often-saved', { stats: saves(20) }),
      ]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual([
      'often-saved',
      'no-data',
      'often-hidden',
    ]);
  });

  it('uses stats loaded by candidate hydrators', async () => {
    const statsForB: CandidateHydrator = {
      name: 'stats',
      hydrate: (candidates) =>
        Promise.resolve(
          candidates.map((c) =>
            c.tripId === 'b' ? { ...c, stats: saves(20) } : c,
          ),
        ),
    };
    const service = buildService(
      [sourceOf('test', [candidate('a'), candidate('b')])],
      [statsForB],
    );

    expect(ids(await service.getPage(viewer))).toEqual(['b', 'a']);
  });

  it('keeps serving when a candidate hydrator fails', async () => {
    const broken: CandidateHydrator = {
      name: 'broken',
      hydrate: () => Promise.reject(new Error('boom')),
    };
    const service = buildService(
      [sourceOf('test', [candidate('a')])],
      [broken],
    );

    expect(ids(await service.getPage(viewer))).toEqual(['a']);
  });

  it('merges a trip returned by more than one source', async () => {
    const service = buildService([
      sourceOf('popular', [candidate('a')]),
      sourceOf('taste', [candidate('a')]),
    ]);

    const { items } = await service.getPage(viewer);

    expect(items).toHaveLength(1);
    expect(items[0].sources).toEqual(['popular', 'taste']);
  });

  it('keeps serving when a source fails', async () => {
    const service = buildService([
      { name: 'broken', fetch: () => Promise.reject(new Error('boom')) },
      sourceOf('test', [candidate('a')]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual(['a']);
  });

  it("excludes the viewer's own trips", async () => {
    const service = buildService([
      sourceOf('test', [
        candidate('mine', { authorId: 'viewer-1' }),
        candidate('theirs'),
      ]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual(['theirs']);
  });

  it('never repeats a trip across pages, even when scores change', async () => {
    const tripIds = ['i0', 'i1', 'i2', 'i3', 'i4'];
    let fetches = 0;
    const shifting: CandidateSource = {
      name: 'shifting',
      fetch: () => {
        // First fetch ranks i0 highest; later fetches rank i4 highest.
        const reversed = fetches++ > 0;
        return Promise.resolve(
          tripIds.map((id, i) =>
            candidate(id, { stats: saves(reversed ? i * 5 : (4 - i) * 5) }),
          ),
        );
      },
    };
    const service = buildService([shifting]);

    const first = await service.getPage(viewer, { limit: 2 });
    const second = await service.getPage(viewer, {
      limit: 2,
      cursor: first.nextCursor!,
    });
    const third = await service.getPage(viewer, {
      limit: 2,
      cursor: second.nextCursor!,
    });

    expect(ids(first)).toEqual(['i0', 'i1']);
    expect(ids(second)).toEqual(['i4', 'i3']);
    expect(ids(third)).toEqual(['i2']);
    expect(third.nextCursor).toBeNull();
  });

  it('starts a new session when there is no cursor', async () => {
    const service = buildService([
      sourceOf('test', [candidate('a'), candidate('b')]),
    ]);

    const first = await service.getPage(viewer, { limit: 1 });
    const again = await service.getPage(viewer, { limit: 1 });

    expect(ids(again)).toEqual(ids(first));
  });

  it('caps the page size', async () => {
    const service = buildService([
      sourceOf(
        'test',
        Array.from({ length: 60 }, (_, i) => candidate(`i${i}`)),
      ),
    ]);

    const page = await service.getPage(viewer, { limit: 1000 });

    expect(page.items).toHaveLength(config.maxPageSize);
  });

  it('rejects an invalid cursor', async () => {
    await expect(
      buildService([]).getPage(viewer, { cursor: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
