# Advanced search (#93)

`GET /api/search` requires authentication. Request and response types are in
`shared-types/search.ts`. Search excludes draft trips and their posts, even
when the viewer owns them.

## Parameters

| Parameter | Usage |
| --- | --- |
| `q` | Required, trimmed, maximum 200 characters. Fewer than 2 characters returns empty results. |
| `type` | `people`, `places`, `trips` or `posts`. Omit for up to 3 results per type. |
| `from`, `to` | Inclusive YYYY-MM-DD range: overlapping trips or posts visited within the range. |
| `minRating` | Minimum place average, 1–5. Applies to places and posts. |
| `lat`, `lng`, `radiusKm` | Distance filter. Requires both coordinates; applies to places, posts and trips with a post inside the radius. A post at a dropped pin (#94) has coordinates, so it counts; a post with only a custom name doesn't. |
| `sort` | `relevance` (default) or `newest`. |
| `limit`, `cursor` | For a selected type: default 20, maximum 50. |

Filters that do not apply to a result type are ignored. Invalid values or
reversed date ranges return 400.

## Responses

Without `type`: `{ people, places, trips, posts }`, each an array.
With `type`: `{ items, nextCursor }`.

People include `isFollowing`. Places include coordinates, `postCount` and
`rating: { average, count } | null`; dropped pins (`provider = 'custom'`, #94)
are excluded from place results, since they're personal spots. Post text search
still matches a pin's name, like a Mapbox place's.
Trips and posts use the existing response shapes. Place ratings use the shared
#91 mapper and totals from rated posts in published trips. Unrated places have
`rating: null` and do not match `minRating`; thresholds use the unrounded average.

Pagination uses the sort key and ID. Cursors are scoped to the viewer and query;
reusing one with different filters or sort returns 400.

## Pending integrations

- **#90:** Replace `search-cursor.ts` with the shared pagination helper.
