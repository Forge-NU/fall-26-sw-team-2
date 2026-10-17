import {
  FEED_ACTIONS,
  type FeedCandidate,
  type ViewerContext,
} from '../feed.types';
import { DEFAULT_FYP_CONFIG } from '../fyp/fyp.config';
import { InMemoryServedHistoryStore } from '../served-history.store';
import { AuthorDiversityScorer } from './author-diversity.scorer';
import { EngagementRateScorer } from './engagement-rate.scorer';
import { PreviouslyServedFilter } from './previously-served.filter';
import { RecencyScorer } from './recency.scorer';
import { applyMultiplier } from './score-utils';
import { ServedHistoryHydrator } from './served-history.hydrator';
import { TopKSelector } from './top-k.selector';
import { UpdateServedHistorySideEffect } from './update-served-history.side-effect';
import { WeightedActionScorer } from './weighted-action.scorer';

const now = new Date('2026-10-14T00:00:00Z');
const viewer: ViewerContext = { viewerId: null, sessionId: 'session-1', now };
const config = DEFAULT_FYP_CONFIG;
const DAY_MS = 24 * 60 * 60 * 1000;

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    tripId: 'a',
    authorId: 'author-a',
    publishedAt: now,
    sources: ['test'],
    predictions: {},
    score: 0,
    ...overrides,
  };
}

function ids(candidates: FeedCandidate[]): string[] {
  return candidates.map((c) => c.tripId);
}

describe('applyMultiplier', () => {
  it('demotes and promotes negative scores the same way as positive ones', () => {
    expect(applyMultiplier(2, 0.5)).toBe(1);
    expect(applyMultiplier(-2, 0.5)).toBe(-4);
    expect(applyMultiplier(-2, 2)).toBe(-1);
  });
});

describe('EngagementRateScorer', () => {
  const scorer = new EngagementRateScorer(config);

  it('falls back to the priors for a trip without stats', async () => {
    const [scored] = await scorer.score([candidate()]);

    for (const action of FEED_ACTIONS) {
      expect(scored.predictions[action]).toBeCloseTo(
        config.actionPriors[action],
      );
    }
  });

  it('smooths the observed rate toward the prior', async () => {
    const [scored] = await scorer.score([
      candidate({ stats: { impressions: 80, actions: { save: 18 } } }),
    ]);

    // (18 + 0.02 × 20) / (80 + 20)
    expect(scored.predictions.save).toBeCloseTo(0.184);
  });

  it('caps predictions at 1', async () => {
    const [scored] = await scorer.score([
      candidate({ stats: { impressions: 0, actions: { open: 50 } } }),
    ]);

    expect(scored.predictions.open).toBe(1);
  });
});

describe('WeightedActionScorer', () => {
  const scorer = new WeightedActionScorer(config);

  it('sums weighted predictions, with negative actions pulling the score down', async () => {
    const [scored] = await scorer.score([
      candidate({ predictions: { save: 0.5, hide: 0.1 } }),
    ]);

    expect(scored.score).toBeCloseTo(6 * 0.5 - 20 * 0.1);
  });
});

describe('RecencyScorer', () => {
  const scorer = new RecencyScorer(config);
  const halfLifeAgo = new Date(
    now.getTime() - config.recency.halfLifeDays * DAY_MS,
  );

  it('decays older trips toward the floor', async () => {
    const scored = await scorer.score(
      [
        candidate({ score: 2 }),
        candidate({ score: 2, publishedAt: halfLifeAgo }),
      ],
      viewer,
    );

    // floor 0.5: one half-life multiplies by 0.5 + 0.5 × 0.5 = 0.75
    expect(scored.map((c) => c.score)).toEqual([2, 1.5]);
  });

  it('pushes negative scores further down as they age', async () => {
    const [scored] = await scorer.score(
      [candidate({ score: -1, publishedAt: halfLifeAgo })],
      viewer,
    );

    expect(scored.score).toBeCloseTo(-1 / 0.75);
  });
});

describe('AuthorDiversityScorer', () => {
  const scorer = new AuthorDiversityScorer(config);

  it("decays each author's later trips down to a floor, keeping input order", async () => {
    const scored = await scorer.score([
      candidate({ tripId: 'y1', authorId: 'y', score: 0.8 }),
      candidate({ tripId: 'x2', authorId: 'x', score: 0.9 }),
      candidate({ tripId: 'x1', authorId: 'x', score: 1 }),
      candidate({ tripId: 'x3', authorId: 'x', score: 0.5 }),
      candidate({ tripId: 'x4', authorId: 'x', score: 0.4 }),
    ]);

    expect(ids(scored)).toEqual(['y1', 'x2', 'x1', 'x3', 'x4']);
    // decay 0.6, floor 0.25: x1 × 1, x2 × 0.6, x3 × 0.36, x4 × 0.25 (0.216 is below the floor)
    const expected = [0.8, 0.9 * 0.6, 1, 0.5 * 0.36, 0.4 * 0.25];
    scored.forEach((c, i) => expect(c.score).toBeCloseTo(expected[i]));
  });
});

describe('TopKSelector', () => {
  const selector = new TopKSelector(config);
  const established = (tripId: string, score: number) =>
    candidate({
      tripId,
      authorId: `author-${tripId}`,
      authorImpressions: 10_000,
      score,
    });
  const newcomer = (score: number) =>
    candidate({
      tripId: 'new',
      authorId: 'author-new',
      authorImpressions: 10,
      score,
    });
  const ranked = [
    established('a1', 1),
    established('a2', 0.9),
    established('a3', 0.8),
    established('a4', 0.7),
  ];

  it('keeps the top K by score', () => {
    const page = selector.select(
      [established('a', 0.2), established('b', 0.9), established('c', 0.5)],
      viewer,
      2,
    );

    expect(ids(page)).toEqual(['b', 'c']);
  });

  it('moves the best new-author trip into the reserved slot', () => {
    const page = selector.select([...ranked, newcomer(0.1)], viewer, 4);

    expect(ids(page)).toEqual(['a1', 'a2', 'new', 'a3']);
  });

  it('leaves the order alone when a new author already ranks near the top', () => {
    const page = selector.select([...ranked, newcomer(0.95)], viewer, 4);

    expect(ids(page)).toEqual(['a1', 'new', 'a2', 'a3']);
  });

  it('does not boost authors whose impressions are unknown', () => {
    const unknown = candidate({ tripId: 'unknown', score: 0.1 });

    const page = selector.select([...ranked, unknown], viewer, 4);

    expect(ids(page)).toEqual(['a1', 'a2', 'a3', 'a4']);
  });
});

describe('served history', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filters out what earlier pages in the session served', async () => {
    const store = new InMemoryServedHistoryStore();
    await new UpdateServedHistorySideEffect(store).run(viewer, [
      candidate({ tripId: 'a' }),
    ]);

    const hydrated = {
      ...viewer,
      ...(await new ServedHistoryHydrator(store).hydrate(viewer)),
    };
    const kept = await new PreviouslyServedFilter().apply(
      [candidate({ tripId: 'a' }), candidate({ tripId: 'b' })],
      hydrated,
    );

    expect(ids(kept)).toEqual(['b']);
  });

  it('keeps sessions separate', async () => {
    const store = new InMemoryServedHistoryStore();
    await store.add('session-1', ['a']);

    expect(await store.get('session-2')).toEqual(new Set());
  });

  it('forgets a session after an hour', async () => {
    const store = new InMemoryServedHistoryStore();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    await store.add('session-1', ['a']);

    clock.mockReturnValue(now.getTime() + 61 * 60 * 1000);

    expect(await store.get('session-1')).toEqual(new Set());
  });
});
