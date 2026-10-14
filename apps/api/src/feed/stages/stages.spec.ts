import { FeedCandidate, ScoredCandidate } from '../feed.types';
import { DEFAULT_FYP_CONFIG } from '../fyp/fyp.config';
import { AuthorDiversityReranker } from './author-diversity.reranker';
import { RecencyHydrator } from './recency.hydrator';
import { WeightedSignalScorer } from './weighted-signal.scorer';

const now = new Date('2026-10-14T00:00:00Z');
const viewer = { viewerId: null, now };
const config = DEFAULT_FYP_CONFIG;
const DAY_MS = 24 * 60 * 60 * 1000;

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    itineraryId: 'a',
    authorId: 'author-a',
    createdAt: now,
    sources: ['test'],
    signals: {},
    ...overrides,
  };
}

function scored(
  itineraryId: string,
  authorId: string,
  score: number,
): ScoredCandidate {
  return { ...candidate({ itineraryId, authorId }), score };
}

describe('WeightedSignalScorer', () => {
  const scorer = new WeightedSignalScorer(config);

  it('sums weighted signals, treating missing ones as 0', () => {
    const score = scorer.score(
      candidate({ signals: { tasteMatch: 1, quality: 0.5 } }),
    );

    expect(score).toBeCloseTo(0.35 + 0.2 * 0.5);
  });

  it('clamps signals to [0, 1]', () => {
    const score = scorer.score(
      candidate({ signals: { tasteMatch: 5, quality: -3 } }),
    );

    expect(score).toBeCloseTo(0.35);
  });
});

describe('RecencyHydrator', () => {
  const hydrator = new RecencyHydrator(config);
  const halfLife = config.recencyHalfLifeDays * DAY_MS;

  it('halves the recency signal every half-life', async () => {
    const ages = [0, halfLife, 2 * halfLife];
    const hydrated = await hydrator.hydrate(
      ages.map((age) =>
        candidate({ createdAt: new Date(now.getTime() - age) }),
      ),
      viewer,
    );

    expect(hydrated.map((c) => c.signals.recency)).toEqual([1, 0.5, 0.25]);
  });

  it('treats future timestamps as brand new and keeps other signals', async () => {
    const [hydrated] = await hydrator.hydrate(
      [
        candidate({
          createdAt: new Date(now.getTime() + DAY_MS),
          signals: { quality: 0.7 },
        }),
      ],
      viewer,
    );

    expect(hydrated.signals).toEqual({ quality: 0.7, recency: 1 });
  });
});

describe('AuthorDiversityReranker', () => {
  const reranker = new AuthorDiversityReranker(config);

  it('spreads out back-to-back items from the same author', () => {
    const result = reranker.rerank([
      scored('x1', 'x', 1),
      scored('x2', 'x', 0.9),
      scored('y1', 'y', 0.8),
    ]);

    expect(result.map((c) => c.itineraryId)).toEqual(['x1', 'y1', 'x2']);
  });

  it('keeps score order when authors are all different', () => {
    const ranked = [scored('a', 'a', 0.9), scored('b', 'b', 0.5)];

    expect(reranker.rerank(ranked)).toEqual(ranked);
  });
});
