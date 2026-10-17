# Feed

Ranks trips for the feed. Only the **FYP** exists so far:
`GET /api/feed/fyp?limit=20&cursor=<nextCursor>`.

Each item is a published trip's card, in the same shapes as the trip and post endpoints,
plus its score and the sources that found it:

```
{ items: [{ trip: TripResponse, posts: PostResponse[], score, sources }], nextCursor }
```

Login is optional. With a valid Clerk session token the viewer is known (so their own
trips are left out); without one, or with an invalid one, they're ranked as signed out.

The pipeline is modeled on [X's For You algorithm](https://github.com/xai-org/x-algorithm)
(its `candidate-pipeline` framework), scaled down to what we can run without a trained
model or much data.

```
viewer hydrators ─► sources ─► candidate hydrators ─► filters ─► scorers ─► selector ─► card loader ─► side effects
```

| Stage | Interface | X equivalent | Registered today |
| --- | --- | --- | --- |
| Viewer hydrators | `ViewerHydrator` | `QueryHydrator` | `ServedHistoryHydrator` |
| Sources | `CandidateSource` | `Source` | `RecentlyPublishedSource` |
| Candidate hydrators | `CandidateHydrator` | `Hydrator` | none (ingest) |
| Filters | `CandidateFilter` | `Filter` | `ExcludeOwnTripsFilter`, `PreviouslyServedFilter` |
| Scorers, in order | `CandidateScorer` | `PhoenixScorer`, `RankingScorer` | `EngagementRateScorer`, `WeightedActionScorer`, `RecencyScorer`, `AuthorDiversityScorer` |
| Selector | `CandidateSelector` | `TopKScoreSelector` | `TopKSelector` |
| Card loader | `FeedCardLoader` | post-selection hydrators | `TripCardLoader` |
| Side effects | `FeedSideEffect` | `SideEffect` | `UpdateServedHistorySideEffect` |

Ranking only needs ids, authors and dates, so posts and media are loaded for the
selected page alone. A trip deleted in between is dropped from the page.

Interfaces live in `feed.types.ts`, numbers in `fyp/fyp.config.ts`, wiring in
`feed.module.ts`.

## How scoring works

1. `EngagementRateScorer` predicts the probability of each action a viewer can take:
   open, like, save, add to trip, share, comment, follow author, hide, report. For now
   it uses the trip's own rate, smoothed toward a baseline so a few views don't
   decide everything: `(count + prior × 20) / (impressions + 20)`. A trained model
   would replace this one scorer.
2. `WeightedActionScorer` combines them: `score = Σ weight × P(action)`. Hide and report
   have negative weights. Weights multiply predicted probabilities, not raw counts.
3. `RecencyScorer` multiplies by `0.5 + 0.5 × 0.5^(age / 30 days)`, so an old trip
   loses at most half its score.
4. `AuthorDiversityScorer` multiplies an author's nth trip (from 0) by
   `max(0.25, 0.6^n)`.
5. `TopKSelector` keeps the top K. If none of the first 3 is from an author with under
   500 impressions, it moves the best such trip up to slot 3.

Every number is a placeholder until we have data to tune against.

## Paging

The cursor carries a session id. Each page records what it served
(`UpdateServedHistorySideEffect`) and the next page filters those out
(`PreviouslyServedFilter`), so pages never repeat even if scores change mid-scroll. A
request without a cursor starts a new session.

A page is marked served as soon as it's returned, so asking for the same cursor again
gives the session's next unserved trips, not the same page. If a response is lost on
the way to the app, its trips are skipped for the rest of that session.

Served history is kept in memory (`served-history.store.ts`). It has to move to Redis or
Postgres before we run more than one API instance.

## Failure handling

- A viewer hydrator, source, candidate hydrator, scorer or side effect that fails is
  logged and skipped.
- A filter that fails fails the request, so we never show something the viewer
  shouldn't see. A filter that relies on viewer data for safety (e.g. blocks) should
  throw if that data didn't load.

## Adding ingest

1. **Viewer data** (follows, blocks, saves, school): add a field to `ViewerData` and a
   `ViewerHydrator` that loads it.
2. **Sources** (popular, same school, matches taste): implement `CandidateSource` and
   register it in `FYP_SOURCES`.
3. **Candidate data**: a `CandidateHydrator` that sets `stats` (impressions and action
   counts) and `authorImpressions`. Load the whole batch in one query.
4. **New action**: add it to `FEED_ACTIONS`, then give it a prior and a weight in
   `DEFAULT_FYP_CONFIG`.
5. **Filters** (blocked authors, hidden trips): implement `CandidateFilter` and
   register it in `FYP_FILTERS`.

## Not borrowed from X (yet)

- The Phoenix transformer, which predicts actions from each viewer's history. It needs
  lots of engagement data; `EngagementRateScorer` holds its place.
- Embedding retrieval, SimClusters and Thunder. Postgres queries cover our scale.
- The labeling and visibility-filtering systems. Filters for blocks and reports are
  enough for now.
- The 48-hour age cutoff and the discount on accounts you don't follow. Both are wrong
  for trips and for Yuji's discovery pitch.

## Known gaps

- No engagement data is tracked yet (impressions, likes, saves: #49), so every trip gets
  the same predictions and ranking comes down to recency and author diversity. The
  new-author slot needs author impressions too, so it stays idle until then.
- Cards include every post of the trip. Fine for MVP trips, but worth capping if trips
  get long.
