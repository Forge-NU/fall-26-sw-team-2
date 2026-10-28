# Search: People and Places

Status: Built
Issue: SRCH-1 (backend for SRCH-2 #48). Depends on LOC-1 (#37) and FOL-1 (#10). SRCH-3 (#93) extends it.

## Overview

The queries behind the search bar. For the MVP, search is plain name matching. Natural-language search ("Clubs in South Korea") comes after the MVP.

Product rules are in DOC-1 ([`mvp-decisions.md`](../product/mvp-decisions.md#map-and-search)). If this doc disagrees with DOC-1, DOC-1 wins.

- People search matches usernames and first and last names.
- Place search only matches locations with posts in **published** trips. Draft trips and their posts are never counted or returned, even to their owner. The map follows the same rule.
- Custom pins (`provider = 'custom'`, LOC-2 #94) never show up in place search.
- Queries need a word of at least 2 characters.

Code: `apps/api/src/search/`. Types are in `apps/shared-types/src/search.ts`.

## `GET /api/search`

Auth: signed in (`ClerkAuthGuard`). Otherwise `401`.

There's one endpoint for every kind of result, so SRCH-3 can add `trips`, `posts` and filters as more `type`s without a new route.

### Query

| Param | Required | Rules |
|---|---|---|
| `type` | Yes | `people` or `places` |
| `q` | No | Trimmed, and runs of spaces count as one. Then at most 100 characters (counted as code points). **Missing, or with no word of at least 2 characters, returns an empty page, not an error**, so the app can search on every keystroke. One-letter words don't filter results (see [Matching and ranking](#matching-and-ranking)). |
| `cursor` | No | `nextCursor` from the previous page of the **same** search |
| `limit` | No | 1 to 50, default 20 |

### Response: `200`

`type` matches the request and says which result shape `items` has.

People:

```json
{
  "type": "people",
  "items": [
    {
      "id": "user_…",
      "username": "mayachen",
      "firstName": "Maya",
      "lastName": "Chen",
      "avatarUrl": null,
      "isFollowing": true
    }
  ],
  "nextCursor": "eyJ0eXBlIjoi…" | null
}
```

`isFollowing` says whether the viewer follows them. It's the same shape as the follower lists. You can show up in your own results, with `isFollowing: false`.

Places:

```json
{
  "type": "places",
  "items": [
    {
      "id": "uuid",
      "name": "Belém Tower",
      "coordinate": { "latitude": 38.691584, "longitude": -9.215977 },
      "city": "Lisbon" | null,
      "region": "Lisbon" | null,
      "countryCode": "PT" | null,
      "postCount": 3,
      "rating": null
    }
  ],
  "nextCursor": null
}
```

- `id`, `name` and `coordinate` match the Explore tab's mock `Place` (MAP-1), so the map can show the result. `id` is the location id, the same one posts reference, and the location page will use it.
- There's no `areaId` yet. Areas don't exist in the data model; MAP-1's are hand-written mock ids. Add it here when the map backend (MAP-2) defines them. `city` and `countryCode` are included in the meantime.
- `postCount` counts posts in published trips only.
- `rating` is `{ average, count }` once post ratings land (RATE-1 #91). Until then it's always `null`.

### Errors

| Status | When |
|---|---|
| `400` | Missing or unknown `type`, `q` over 100 characters or containing a NUL character, `limit` out of range, or a cursor that's malformed or from a different search (another `type` or `q`) |
| `401` | Not signed in |

## Matching and ranking

- **Every word of 2 or more characters has to match.** The query is split on spaces, and each of those words must appear (case-insensitive substring, `ILIKE`) in at least one column:
  - People: `username`, `first_name`, `last_name`. So `maya chen` finds first name Maya, last name Chen.
  - Places: `name`, `city`, `region`. So `tower lisbon` finds Belém Tower in Lisbon. Accents have to match for now (`belem` doesn't find Belém, see [Not yet](#not-yet)).
- One-letter words would match almost everything, so they only affect ranking. `maya c` finds every Maya, and the full-name prefix match puts Maya Chen first.
- `%`, `_` and `\` in the query match literally.
- **Ranking**, best first:
  - People: a prefix match on the username, first name, last name or full name ranks above a match in the middle of a word. Ties are broken by trigram similarity (`pg_trgm`) to the whole query, then id.
  - Places: a prefix match on the name, then similarity of the name to the query, then post count, then id.

## Pagination

Results are ordered by relevance rather than by id, so the cursor holds the last row's sort key (rank, plus post count for places, plus id). It's bound to the `type` and `q` it came from, and the next page continues strictly after it, so no result repeats or gets skipped while the results don't change. If a person's name or a place's post count changes mid-session, its rank changes, so it can move across a page boundary and repeat or be skipped. It's opaque to the app. Pass it back unchanged.

This is the search version of the cursor in `common/pagination.ts`. It moves to the shared helper from API-2 (#90) when that lands.

## Indexes and performance

The migration `20261028150241_add_search_indexes` enables `pg_trgm` and adds trigram GIN indexes:

- `User`: `username`, `first_name`, `last_name`
- `locations`: `name`, `city`, `region`

Each word's `ILIKE` checks can use those indexes (a `BitmapOr` across the three columns). On the seeded data the people and place queries each run in under a millisecond, and `EXPLAIN` with sequential scans disabled shows the trigram indexes in use. For place search, the planner may instead start from the published trips when there are few of them.

Ranking is computed, so every page scores and sorts all the matches before taking its slice. That's fine at MVP scale, but a broad query costs more per page.

A 2-character word has no full trigram, so Postgres can't use the index for it and scans the table. That's fine at MVP scale. If it gets slow, add a prefix index or raise the minimum.

Account deletion deletes the user row (DOC-1), so there's no deleted-user flag to filter on, and a deleted account can never be matched.

## Not yet

- **Typo tolerance.** `pg_trgm`'s similarity operators (`%`, `<%`) could match "mya" to "Maya". Not in the MVP, since it's plain name matching.
- **Accents.** `unaccent` would let "belem" match "Belém". It needs another extension and an immutable wrapper function to be indexable.
- **Ratings** on place results, from RATE-1 (#91).
- **Trips, posts and filters** (SRCH-3 #93).
- **Natural-language search** (post-MVP).
