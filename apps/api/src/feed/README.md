# Feed

Ranks itineraries for the feed. Only the **For You** feed exists so far:
`GET /feed/for-you?limit=20&cursor=<nextCursor>`.

```
sources ──► hydrators ──► filters ──► scorer ──► reranker ──► page
(retrieve)   (signals)    (remove)    (score)    (reorder)
```

| Stage | Interface | Job | Registered today |
| --- | --- | --- | --- |
| Source | `CandidateSource` | Pull a pool of candidate itineraries | none (feed is empty until ingest) |
| Hydrator | `SignalHydrator` | Set signals (0 to 1) on each candidate | `RecencyHydrator` |
| Filter | `CandidateFilter` | Drop what the viewer must not see | `ExcludeOwnItinerariesFilter` |
| Scorer | `CandidateScorer` | Turn signals into one score | `WeightedSignalScorer` |
| Reranker | `FeedReranker` | Reorder for variety | `AuthorDiversityReranker` |

Interfaces live in `feed.types.ts`. Weights, page size and other knobs live in
`for-you/for-you.config.ts`. Wiring is in `feed.module.ts`.

## Failure handling

- A source that throws is logged and skipped. The feed shows what the others found.
- A hydrator that throws is logged and skipped. Its signal scores 0.
- A filter that throws fails the request. Better an error than showing blocked or
  hidden content.

## Adding ingest

1. **New signal**: add its name to `FEED_SIGNALS` in `feed.types.ts` and give it a weight
   in `DEFAULT_FOR_YOU_CONFIG`. TypeScript flags the config until you do.
2. **New source** (e.g. popular itineraries, same school, taste match): implement
   `CandidateSource`, make it `@Injectable()`, and add it to `FOR_YOU_SOURCES` in
   `feed.module.ts` with a `useFactory` like the hydrators one.
3. **New hydrator** (e.g. engagement from saves/likes, quality from ratings): implement
   `SignalHydrator`, normalize values to 0 to 1, and add it to `FOR_YOU_HYDRATORS`.
   Fetch data for the whole batch in one query, not one per candidate.
4. **New filter** (e.g. blocked authors, already seen): implement `CandidateFilter` and
   add it to `FOR_YOU_FILTERS`.

## Known gaps

- The viewer comes from the `x-user-id` header until auth exists. Anyone can set it.
- The feed returns ids and scores only. The client loads itinerary details separately
  until we decide whether the feed should embed them.
- Every request re-ranks from scratch, so items can shift between pages mid-scroll.
