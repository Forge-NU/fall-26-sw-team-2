# Feed

Issue: #26 (FEED-1)
Product rules: [`mvp-decisions.md`](../product/mvp-decisions.md#feed-and-navigation) (#33 DOC-1)
Unblocks: #27 (FEED-2, feed screen)
Post-MVP: the algorithmic feed (#5) and FYP (#118 FEED-3, #59)

## Overview

- **Friends** is the only feed in the MVP: published trips owned by people you follow, newest publish first.
- Each trip appears once, as a trip card, when it's published. Posts added after publishing show on its card but don't move the trip back to the top.
- Drafts and their posts never appear.
- Trips the people you follow only collaborate on aren't included. Joined trips don't show on a profile either ([`shared-trips.md`](shared-trips.md)), and who's on a trip is only visible to its members.
- Each feed item has everything a trip card needs, so the app makes no extra requests per card.
- The ranking lives behind one interface, so an algorithmic version can replace the chronological one without changing the endpoint or the app.

## API Contract

### `GET /api/feed?type=friends|local&cursor=&limit=` → 200 `FeedResponse`

Needs a Clerk session. Errors use the shared shape in [`api-conventions.md`](api-conventions.md#error-response-shape).

| Query | Values |
|---|---|
| `type` | `friends` (default) or `local`. Anything else is 400. `local` is post-MVP and always returns `{ "items": [], "nextCursor": null }`. FYP has its own endpoint (#118), so it isn't a type here. |
| `cursor`, `limit` | The cursor pagination in [`api-conventions.md`](api-conventions.md#cursor-based-pagination): `limit` 1-50, default 20. A malformed cursor, or one from another user's feed, is 400 `Invalid cursor`. |

Response types are in `shared-types` (`apps/shared-types/src/feed.ts`):

```typescript
type FeedType = 'friends' | 'local';

type FeedItem = {
  trip: TripResponse;     // the same shape as GET /api/trips/:id
  posts: PostResponse[];  // the posts the card's day previews use, in trip order (see below)
};

type FeedResponse = PaginatedResponse<FeedItem>;
```

`trip` and `posts` are the same shapes the trip and post endpoints return, with media URLs, locations, like, save and comment counts, and `likedByMe` and `savedByMe` for the viewer. `TripCard` takes them as its `trip` and `posts` props.

### Which posts a card gets

Not every post. The card shows one preview per day, titled by the day's first post with a location and covered by the day's first image. So for each day the feed sends:

- the day's first post with a location (a Mapbox place, a dropped pin or a custom name), and
- the day's first post with an image.

These are often the same post, so a card has at most two posts a day, however many the trip has. A day with no location or image in any post (only videos without a place, say) gets its first post, so the day still has a preview. `trip.postCount` is still the trip's real total. The trip page reads every post from `GET /api/trips/:id/posts`, which has its own pagination.

The selection matches what `TripCard` reads today (`apps/mobile/src/components/content/trip-card.tsx`). If the card's previews change, change `pickCardPosts` in `posts.service.ts` to match.

A user who follows nobody, or whose follows haven't published anything, gets an empty page, not an error.

## Ordering and Pagination

The Friends feed is ordered by `(published_at DESC, id DESC)` and pages with the shared keyset helper. The cursor holds the last card's `published_at` and `id`, and its list name includes the viewer (`feed:friends:<userId>`).

- **New trips don't repeat or skip anything.** A trip published while someone is scrolling has a later `published_at`, so it sorts above the cursor. It shows up at the top on the next refresh, and the rest of the scroll is unchanged.
- **New posts don't move trips.** The order only uses `published_at`, which is set once when the trip is published.
- **Unfollowing mid-scroll** removes that person's trips from the following pages. Nothing repeats.

`published_at` is nullable in the schema, but a check constraint sets it exactly when the trip is published, and the query only reads published trips. The existing `trips (status, published_at)` index covers the order.

## Implementation

`apps/api/src/feed/`:

| File | What it does |
|---|---|
| `feed.controller.ts` | The route, validated by `dto/feed-query.dto.ts` |
| `feed.service.ts` | Returns the empty page for `local`. For `friends`, asks the ranking for a page of trip ids, then builds the cards in that order. |
| `feed-ranking.service.ts` | `FeedRankingService`, the abstract class every ranking extends. It's also the Nest token. |
| `chronological-feed-ranking.ts` | The MVP ranking described above |
| `feed.module.ts` | Binds `FeedRankingService` to `ChronologicalFeedRanking` |

A page takes four queries, however many cards it has:

1. The ranking: one page of trip ids.
2. The trips: `TripsService.findManyForViewer`. A trip deleted between the two queries isn't returned, so it's dropped instead of failing the page. It only checks that the viewer can see the trip, not that they follow its owner. Keeping the Friends feed to follows is the ranking's job.
3. and 4. The posts: `PostsService.listCardPostsForTrips` (adapted from #59's `listForTrips`). One light query reads every post's id, date and whether it has a location or an image, `pickCardPosts` chooses the ones above, and a second query loads just those in full. Each owner's avatar is signed once per page, not once per post.

### Swapping the ranking

An algorithmic ranking (#5) extends `FeedRankingService` and is bound in `feed.module.ts` instead of `ChronologicalFeedRanking`:

```typescript
{ provide: FeedRankingService, useClass: AlgorithmicFeedRanking },
```

The controller, `FeedService` and the response shape don't change. A ranking only returns trip ids and a cursor, and it must only return published trips. It should page with the helpers in `common/pagination.ts`, or, like FYP, document why it doesn't.

## Seed Data

`npx prisma db seed` gives the seeded users these Friends feeds:

| User | Follows | Feed |
|---|---|---|
| Alex | Maya, Priya | Lisbon layover, Weekend in Copenhagen, 5 Days in Lisbon |
| Maya | Priya | Lisbon layover, Weekend in Copenhagen |
| Priya | Maya | 5 Days in Lisbon |

Maya's Porto draft and Alex's Sintra draft are in no one's feed, and nobody follows Alex, so his published Belém trip isn't either.

## Tests

- `apps/api/src/feed/feed.service.spec.ts`: `local` returns an empty page, cards come back in the ranking's order with any ranking, and trips that can't be loaded are dropped.
- `apps/api/src/posts/pick-card-posts.spec.ts`: which posts a card gets, including a day with no location or image, and that a 300-post trip still sends one post a day.
- `apps/api/test/feed.e2e-spec.ts`: an empty feed for a user who follows nobody; drafts, unfollowed users' trips and joined trips are excluded; the card's posts come in trip order, without the extra posts on a day; `postCount` stays the real total; publishing between page 1 and page 2 doesn't repeat or skip a trip; a post added after publishing doesn't move its trip; both feed types; bad types and cursors.
