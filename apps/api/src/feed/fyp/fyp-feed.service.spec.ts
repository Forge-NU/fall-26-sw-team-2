import { BadRequestException, Logger } from '@nestjs/common';
import {
  CandidateSource,
  SignalHydrator,
  SourcedCandidate,
  ViewerContext,
} from '../feed.types';
import { AuthorDiversityReranker } from '../stages/author-diversity.reranker';
import { ExcludeOwnItinerariesFilter } from '../stages/exclude-own-itineraries.filter';
import { RecencyHydrator } from '../stages/recency.hydrator';
import { WeightedSignalScorer } from '../stages/weighted-signal.scorer';
import { DEFAULT_FYP_CONFIG } from './fyp.config';
import { FypFeedService } from './fyp-feed.service';

const now = new Date('2026-10-14T00:00:00Z');
const viewer: ViewerContext = { viewerId: 'viewer-1', now };
const config = DEFAULT_FYP_CONFIG;

function candidate(
  itineraryId: string,
  overrides: Partial<SourcedCandidate> = {},
): SourcedCandidate {
  return {
    itineraryId,
    authorId: `author-${itineraryId}`,
    createdAt: now,
    signals: {},
    ...overrides,
  };
}

function sourceOf(
  name: string,
  candidates: SourcedCandidate[],
): CandidateSource {
  return { name, fetch: () => Promise.resolve(candidates) };
}

function buildService(
  sources: CandidateSource[],
  hydrators: SignalHydrator[] = [new RecencyHydrator(config)],
): FypFeedService {
  return new FypFeedService(
    config,
    sources,
    hydrators,
    [new ExcludeOwnItinerariesFilter()],
    new WeightedSignalScorer(config),
    new AuthorDiversityReranker(config),
  );
}

function ids(page: { items: { itineraryId: string }[] }): string[] {
  return page.items.map((item) => item.itineraryId);
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

  it('ranks candidates by weighted signals', async () => {
    const service = buildService([
      sourceOf('test', [
        candidate('a', { signals: { tasteMatch: 0.2 } }),
        candidate('b', { signals: { tasteMatch: 0.9 } }),
        candidate('c', { signals: { quality: 1 } }),
      ]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual(['b', 'c', 'a']);
  });

  it('merges an itinerary returned by more than one source', async () => {
    const service = buildService([
      sourceOf('popular', [candidate('a', { signals: { engagement: 0.8 } })]),
      sourceOf('taste', [candidate('a', { signals: { tasteMatch: 0.6 } })]),
    ]);

    const { items } = await service.getPage(viewer);

    expect(items).toHaveLength(1);
    expect(items[0].sources).toEqual(['popular', 'taste']);
    expect(items[0].score).toBeCloseTo(0.2 * 0.8 + 0.35 * 0.6 + 0.15);
  });

  it('keeps serving when a source fails', async () => {
    const service = buildService([
      { name: 'broken', fetch: () => Promise.reject(new Error('boom')) },
      sourceOf('test', [candidate('a')]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual(['a']);
  });

  it('keeps serving when a hydrator fails', async () => {
    const broken: SignalHydrator = {
      name: 'broken',
      hydrate: () => Promise.reject(new Error('boom')),
    };
    const service = buildService(
      [sourceOf('test', [candidate('a', { signals: { quality: 1 } })])],
      [broken],
    );

    const { items } = await service.getPage(viewer);

    expect(items[0].score).toBeCloseTo(0.2);
  });

  it("excludes the viewer's own itineraries", async () => {
    const service = buildService([
      sourceOf('test', [
        candidate('mine', { authorId: 'viewer-1' }),
        candidate('theirs'),
      ]),
    ]);

    expect(ids(await service.getPage(viewer))).toEqual(['theirs']);
  });

  it('pages through the ranked list with a cursor', async () => {
    const service = buildService([
      sourceOf(
        'test',
        [0.9, 0.8, 0.7, 0.6, 0.5].map((tasteMatch, i) =>
          candidate(`i${i}`, { signals: { tasteMatch } }),
        ),
      ),
    ]);

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
    expect(ids(second)).toEqual(['i2', 'i3']);
    expect(ids(third)).toEqual(['i4']);
    expect(third.nextCursor).toBeNull();
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
