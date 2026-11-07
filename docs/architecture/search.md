# Advanced search (#93)

`GET /api/search` requires authentication. Request and response types are in
`shared-types/search.ts`. Search excludes draft trips and their posts, even
when the viewer owns them.

## Parameters

| Parameter | Usage |
| --- | --- |
| `q` | Required, normalized whitespace, maximum 200 characters. No words of 2+ characters returns empty results. |
| `type` | `people`, `places`, `trips` or `posts`. Omit for up to 3 results per type. |
| `from`, `to` | Inclusive YYYY-MM-DD range: overlapping trips or posts visited within the range. |
| `minRating` | Minimum place average, 1–5. Applies to places and posts. |
| `lat`, `lng`, `radiusKm` | Distance filter. Requires both coordinates; applies to places, posts and trips with a post inside the radius. |
| `sort` | `relevance` (default) or `newest`. |
| `limit`, `cursor` | For a selected type: default 20, maximum 50. |

Filters that do not apply to a result type are ignored. Invalid values or
reversed date ranges return 400.

## Responses

Without `type`: `{ people, places, trips, posts }`, each an array.
With `type`: `{ type, items, nextCursor }`.

People include `isFollowing`. Places retain #21's `coordinate`, `postCount` and
`rating: { average, count } | null`; custom pins are excluded from place results.
Trips and posts use the existing response shapes.

Pagination uses the sort key and ID. Cursors are scoped to the viewer and query;
reusing one with different filters or sort returns 400.

## Dependencies

- **#21:** Reuses search normalization, multiword matching, result shapes
  and index migration from `feat/srch-1-search-backend`. #93 adds the preview,
  trip/post types, filters and sort-scoped cursors.
- **#91 / [PR #112](https://github.com/Forge-NU/fall-26-sw-team-2/pull/112):**
  Integrated locally. Search reads the real rating totals and reuses its rating
  mapper. Database tests verify post updates and publishing change search results.
- **#90:** Replace `search-cursor.ts` with the shared pagination helper
  when available.
