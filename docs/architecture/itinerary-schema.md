# Itinerary Schema: Trips, Posts, Locations

Status: Built (schema), endpoints in review
Issue: #3

## Overview

This doc covers the data model and API contracts for trips, posts, post media, and locations. The feed, map, search, stories, and profiles all read from these tables.

The product rules come from DOC-1 (#33): [`docs/product/mvp-decisions.md`](../product/mvp-decisions.md), and the cross-feature data model is in [`docs/architecture/data-model.md`](data-model.md). If this doc disagrees with DOC-1, DOC-1 wins and this doc should be fixed.

Related work:
- #15 Auth/Users: defines `User`. Every user reference here is the Clerk user ID (a string like `user_123`).
- #37 LOC-1: validates the `locations` table against Mapbox and adds the endpoint that creates location rows. See [`locations.md`](locations.md).
- #38 MEDIA-1: the presigned upload endpoint that produces the S3 keys posts reference. See [`media-uploads.md`](media-uploads.md).
- #23 STORY-1: stories link to trips and use the active-trip rule below.
- #9 / #41 trip screens, #8 / #42 post composer, #12 / #27 feed: the screens these contracts support.

Conventions:
- Prisma models live in `apps/api/prisma/models/`, one file per model.
- Columns are snake_case and JSON is camelCase.
- Primary keys are UUIDs, except `users.id`.
- Dates without a time (`start_date`, `end_date`, `visited_on`) are `DATE` columns and `YYYY-MM-DD` strings in JSON.
- We store S3 keys, never URLs. The API turns keys into URLs when it reads a row.
- Prisma can't express check constraints, so they're raw SQL at the end of the migration that creates the table.

## Relationships

```mermaid
erDiagram
    users ||--o{ trips : owns
    trips ||--o{ posts : contains
    posts ||--|{ post_media : has
    locations |o--o{ posts : "tagged at"

    users {
        string id PK "Clerk user ID"
        string username
        string first_name
        string last_name
        string avatar_url "nullable"
    }
    trips {
        uuid id PK
        string owner_id FK
        string title
        string destination
        string description "nullable"
        date start_date
        date end_date
        trip_status status "draft or published"
        timestamp published_at "nullable"
        timestamp created_at
        timestamp updated_at
    }
    posts {
        uuid id PK
        uuid trip_id FK
        uuid location_id FK "nullable"
        string custom_location_name "nullable"
        string caption "nullable"
        date visited_on
        timestamp created_at
        timestamp updated_at
    }
    post_media {
        uuid id PK
        uuid post_id FK
        string s3_key UK
        media_type media_type
        smallint position
        int width "nullable"
        int height "nullable"
        int duration_ms "nullable"
        timestamp created_at
    }
    locations {
        uuid id PK
        string provider
        string provider_place_id
        string name
        string address "nullable"
        decimal latitude
        decimal longitude
        string city "nullable"
        string region "nullable"
        char country_code "nullable"
        timestamp created_at
        timestamp updated_at
    }
```

`users` is owned by #15. Only the fields this doc uses are shown.

A trip is a dated itinerary made of posts. A post is media within a trip, with a caption, a date, and one location. Every post belongs to exactly one trip, and a post's author is always its trip's owner, so posts don't store an author.

## Data Model

### Enums

| Enum | Values |
|---|---|
| `trip_status` | `draft`, `published` |
| `media_type` | `image`, `video` |

### trips

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | No | Generated | Primary key | |
| `owner_id` | String | No | | FK `users.id`, on delete cascade | Trip creator |
| `title` | Varchar(100) | No | | | |
| `destination` | Varchar(100) | No | | | Free text, e.g. "Lisbon, Portugal". Display only, the map and search don't use it. |
| `description` | Varchar(1000) | Yes | `NULL` | | |
| `start_date` | Date | No | | | |
| `end_date` | Date | No | | `end_date >= start_date` | |
| `status` | `trip_status` | No | `draft` | | |
| `published_at` | Timestamp | Yes | `NULL` | Set exactly when `status = 'published'` | The feed sorts by it |
| `created_at` | Timestamp | No | Current timestamp | | |
| `updated_at` | Timestamp | No | Current timestamp | | |

Check constraints:
- `trips_dates_check`: `end_date >= start_date`
- `trips_published_at_check`: `(status = 'published') = (published_at IS NOT NULL)`

Indexes: `(owner_id, start_date)` for profiles and the active-trip lookup, `(status, published_at)` for the feed.

There's no cover image column. The trip card uses the first photo of the trip's first post.

#### Active trip

A trip is active when it's a draft and today falls between its start and end dates, inclusive:

```
status = 'draft' AND start_date <= today AND today <= end_date
```

"Today" is the date in the user's time zone, sent by the app (see [Active trips](#get-apimetripsactive)). Publishing a trip ends its active period, even if the end date hasn't passed. Only active trips can have stories linked to them (#23).

### posts

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | No | Generated | Primary key | |
| `trip_id` | UUID | No | | FK `trips.id`, on delete cascade | |
| `location_id` | UUID | Yes | `NULL` | FK `locations.id`, on delete restrict | Set for a Mapbox place |
| `custom_location_name` | Varchar(100) | Yes | `NULL` | | Set for a custom location the user typed |
| `caption` | Varchar(2200) | Yes | `NULL` | | |
| `visited_on` | Date | No | | | The day it happened. Must fall within the trip's dates (checked by the API). |
| `created_at` | Timestamp | No | Current timestamp | | |
| `updated_at` | Timestamp | No | Current timestamp | | |

Check constraint `posts_location_check`: exactly one of `location_id` and `custom_location_name` is set, `(location_id IS NULL) <> (custom_location_name IS NULL)`.

The database doesn't check that `visited_on` is within the trip's dates, because the trip's dates can change. The API checks it when a post is created or edited, and rejects a trip date change that would leave a post outside the new dates.

Posts in a trip are ordered by `visited_on`, then `created_at`. The app groups them into days by `visited_on`.

Indexes: `(trip_id, visited_on, created_at)` for the trip page, `(location_id)` for the map and location pages, `(created_at)` for recent posts.

A post must have 1 to 30 media items. The API enforces the minimum, and `post_media.position` caps the maximum.

### post_media

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | No | Generated | Primary key | |
| `post_id` | UUID | No | | FK `posts.id`, on delete cascade | |
| `s3_key` | String | No | | Unique | Object key in the media bucket |
| `media_type` | `media_type` | No | | | Video upload is #53 MEDIA-2 |
| `position` | Smallint | No | | Unique with `post_id`, 0 to 29 | Carousel order |
| `width` | Integer | Yes | `NULL` | | Pixels |
| `height` | Integer | Yes | `NULL` | | Pixels |
| `duration_ms` | Integer | Yes | `NULL` | | Video only |
| `created_at` | Timestamp | No | Current timestamp | | |

Check constraint `post_media_position_check`: `position BETWEEN 0 AND 29`, which caps a post at 30 items.

### locations

A shared row for a Mapbox place. Two posts tagged at the same place share one row, which is what lets the map and place search group posts by place. Rows are deduplicated by `(provider, provider_place_id)`. We store `provider` so a second provider later doesn't cause ID collisions.

Custom locations (a name the user typed when search had no result) are stored on the post as `custom_location_name`, not as a row here. That way a location never belongs to one user and is never deleted.

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | No | Generated | Primary key | |
| `provider` | Varchar(20) | No | | Unique with `provider_place_id` | `mapbox` for now |
| `provider_place_id` | String | No | | Unique with `provider` | Mapbox's ID for the place |
| `name` | String | No | | | Display name, e.g. "Pastéis de Belém" |
| `address` | String | Yes | `NULL` | | Formatted address |
| `latitude` | Decimal(9,6) | No | | -90 to 90 | |
| `longitude` | Decimal(9,6) | No | | -180 to 180 | |
| `city` | String | Yes | `NULL` | | |
| `region` | String | Yes | `NULL` | | State or province |
| `country_code` | Char(2) | Yes | `NULL` | | ISO 3166-1 alpha-2 |
| `created_at` | Timestamp | No | Current timestamp | | |
| `updated_at` | Timestamp | No | Current timestamp | | |

Check constraints: `locations_latitude_check` and `locations_longitude_check` for the ranges above.

Indexes: `(provider, provider_place_id)` unique, `(latitude, longitude)` for map bounding-box queries. We can move to PostGIS later if we need radius search.

Mapbox's storage terms are recorded in [DOC-1](../product/mvp-decisions.md#locations): storing POI coordinates isn't allowed as-is, and that decision is still open. If the outcome is that we can't store coordinates, this table changes. Rows are created by `POST /api/locations/resolve` ([`locations.md`](locations.md)).

## Visibility

Everything is public once published, and visibility is decided by the trip.

`canView(viewer, trip)` is true when `trip.status = 'published'` or `trip.owner_id = viewer`.

- A post can be seen when its trip can be seen.
- A draft trip, or a post in one, returns 404 to anyone but the owner, not 403, so we don't reveal that it exists.
- Changing a trip or a post the viewer can see but doesn't own returns 403.
- A user's trip list includes drafts only when the viewer is that user.
- The feed, map, search, and location pages only include rows from published trips. The rule is in one Prisma `where` helper, `visibleTripWhere(viewerId)` in `apps/api/src/trips/trip-rules.ts`, so other services don't each rewrite it.

## Deletion

There are no soft deletes. Deleting a row deletes everything under it through `ON DELETE CASCADE`.

| Foreign key | On delete |
|---|---|
| `trips.owner_id` → `users` | Cascade |
| `posts.trip_id` → `trips` | Cascade |
| `post_media.post_id` → `posts` | Cascade |
| `posts.location_id` → `locations` | Restrict (locations are shared and never deleted) |

So deleting an account deletes the user's trips, which deletes their posts and media rows. Stories (#23), likes and saves (#49), and comments (#50) add their own cascades to `trips` and `posts`.

Cascades remove rows but not S3 objects. Trip and post deletes:
1. Read the `post_media.s3_key` values that are about to go.
2. Delete the rows in one transaction.
3. After the transaction commits, delete the objects with `DeleteObjects`, in batches of up to 1,000 keys.

If step 3 fails, the keys are logged and the delete stays in place. An object without a row is harmless and can be swept later. The same applies to media removed from a post when it's edited.

Account deletion (`DELETE /api/me`, #15) doesn't go through these endpoints, so it has to collect the user's media keys itself (or delete the `users/{userId}/` prefix).

## API Contracts

All endpoints are under `/api` and require a valid Clerk session (the `ClerkAuthGuard` from #15). The current user always comes from the session, never from the request body.

Errors use NestJS's default shape until API-1 (#28) adds the shared error filter:

```json
{ "statusCode": 404, "message": "Trip not found", "error": "Not Found" }
```

Validation errors (400) return `message` as a list of strings. Unknown fields in a request body are rejected. Text limits are counted the way Postgres counts characters, so an emoji like ❤️ (heart plus a variation selector) counts as 2.

List endpoints use cursor pagination: `?cursor=<from the last page>&limit=<1-50, default 20>` returns `{ "items": [...], "nextCursor": "..." | null }`. `nextCursor` is `null` on the last page. A cursor that doesn't belong to that list (unknown, deleted, or from another list) returns 400, and the app should reload from the first page. The helper is a stand-in until API-1 (#28) adds the shared one.

### Shared response shapes

These are TypeScript types in `apps/api` for now (`trips/trip.types.ts`, `posts/post.types.ts`). They move into `shared-types` once API-1 (#28) adds it.

`UserSummary` (fields from #15's `User`):
```json
{ "id": "user_123", "username": "mayachen", "firstName": "Maya", "lastName": "Chen", "avatarUrl": "https://..." | null }
```

`Trip`:
```json
{
  "id": "uuid",
  "owner": UserSummary,
  "title": "5 Days in Lisbon",
  "destination": "Lisbon, Portugal",
  "description": "Sunset viewpoints, custard tarts, tram rides and a day trip to Sintra." | null,
  "startDate": "2026-09-12",
  "endDate": "2026-09-16",
  "status": "draft" | "published",
  "publishedAt": "2026-09-18T15:00:00.000Z" | null,
  "postCount": 6,
  "coverImageUrl": "https://..." | null,
  "createdAt": "2026-09-10T12:00:00.000Z",
  "updatedAt": "2026-09-18T15:00:00.000Z"
}
```

- `coverImageUrl` is the first photo of the trip's first post, or `null` if the trip has no photos yet.
- The number of days is `endDate - startDate + 1`, so it isn't returned.

`Location`:
```json
{
  "id": "uuid",
  "provider": "mapbox",
  "providerPlaceId": "dXJuOm1ieHBvaTo...",
  "name": "Pastéis de Belém",
  "address": "R. de Belém 84-92, 1300-085 Lisboa" | null,
  "latitude": 38.697464,
  "longitude": -9.203213,
  "city": "Lisbon" | null,
  "region": "Lisbon" | null,
  "countryCode": "PT" | null
}
```

`Post`:
```json
{
  "id": "uuid",
  "tripId": "uuid",
  "author": UserSummary,
  "caption": "Six pastéis between the two of us. No regrets." | null,
  "visitedOn": "2026-09-12",
  "location": Location | null,
  "customLocationName": "Tia Rosa's kitchen" | null,
  "media": [
    { "id": "uuid", "mediaType": "image", "url": "https://...", "width": 1080, "height": 1350, "durationMs": null }
  ],
  "createdAt": "2026-09-12T18:40:00.000Z",
  "updatedAt": "2026-09-12T18:40:00.000Z"
}
```

- Exactly one of `location` and `customLocationName` is set.
- `media` is in carousel order.
- Media URLs are presigned S3 GET URLs that expire after an hour. Locally, with no `S3_BUCKET_NAME` set, they point at `https://media.invalid/<key>`, which never loads.
- Like, comment, and save counts get added by #49 and #50.

### Trips

#### `POST /api/trips`

Request:
```json
{
  "title": "5 Days in Lisbon",
  "destination": "Lisbon, Portugal",
  "description": "Sunset viewpoints, custard tarts, tram rides and a day trip to Sintra.",
  "startDate": "2026-09-12",
  "endDate": "2026-09-16"
}
```

- `title` and `destination`: required, 1 to 100 characters. Leading and trailing spaces are trimmed.
- `description`: optional, up to 1,000 characters.
- `startDate` and `endDate`: required. `endDate` can't be before `startDate`. Past and future dates are both allowed.

Every trip starts as a draft. Response `201`: `Trip`.

Errors: `400` for validation, including an end date before the start date.

#### `GET /api/trips/:id`

Response `200`: `Trip`.

Errors: `404` if the trip doesn't exist, or it's a draft and the viewer isn't the owner.

#### `PATCH /api/trips/:id`

Owner only. Any of `title`, `destination`, `description`, `startDate`, `endDate`. Send `"description": null` to clear it. Status can't be changed here (see publish).

Response `200`: `Trip`.

Errors:
- `400` for validation, if the new dates would put the end before the start, or if any of the trip's posts would fall outside the new dates.
- `403` if the viewer can see the trip but doesn't own it.
- `404` as in `GET`.

#### `DELETE /api/trips/:id`

Owner only. Permanently deletes the trip, its posts, and their media, including the S3 objects. Stories, likes, saves, and comments on it go with it once those tables exist. The app shows the confirmation prompt.

Response `204`. Errors: `403`, `404` as in `PATCH`.

#### `POST /api/trips/:id/publish`

Owner only. Sets `status` to `published` and `publishedAt` to now. From then on the trip and its posts are visible to everyone. Publishing can't be undone. Publishing an already-published trip succeeds without changing it.

Response `200`: `Trip`.

Errors: `400` if the trip has no posts, and `403` and `404` as in `PATCH`.

#### `GET /api/users/:userId/trips`

Paginated `Trip` list for a profile, newest start date first. Includes drafts only when `userId` is the current user.

Errors: `404` if the user doesn't exist.

#### `GET /api/me/trips/active`

The current user's active trips (see [Active trip](#active-trip)), newest start date first. The story composer uses this to suggest a trip, and to list the trips a story can be linked to.

Query: `?date=YYYY-MM-DD`, the user's local date. Optional, and defaults to the server's UTC date. It has to be within one day of the server's UTC date, since every time zone is.

Response `200`:
```json
{ "items": [ Trip ] }
```

It isn't paginated, since a user only has a handful of trips whose dates include today.

Errors: `400` if `date` isn't a valid date or is more than a day away from the server's date.

### Posts

#### `POST /api/posts`

Request:
```json
{
  "tripId": "uuid",
  "visitedOn": "2026-09-12",
  "caption": "Six pastéis between the two of us. No regrets.",
  "locationId": "uuid",
  "media": [
    { "s3Key": "users/user_123/posts/uuid.jpg", "mediaType": "image", "width": 1080, "height": 1350 }
  ]
}
```

- `tripId`: required. Only the trip's owner can add posts to it.
- `visitedOn`: required, within the trip's dates. The app fills it in with today if today is within the trip's dates, otherwise the trip's start date.
- `caption`: optional, up to 2,200 characters.
- Location: exactly one of `locationId` (an existing location row, from `POST /api/locations/resolve`) and `customLocationName` (1 to 100 characters).
- `media`: 1 to 30 items, in carousel order. Each `s3Key` has to be one of the current user's post uploads (it starts with `users/{userId}/posts/`, the key scheme from #38), can't appear twice, and can't already belong to another post. `width` and `height` (1 to 20,000 px) and `durationMs` (up to 60,000) are optional.

The app only calls this after every upload has succeeded.

Response `201`: `Post`.

Errors:
- `400` for validation, a `visitedOn` outside the trip's dates, a location that doesn't exist, or an invalid or already-used media key.
- `403` if the trip is published but belongs to someone else.
- `404` if the trip doesn't exist, or it's someone else's draft.

#### `GET /api/posts/:id`

Response `200`: `Post`.

Errors: `404` if the post doesn't exist, or its trip is a draft and the viewer isn't the owner.

#### `PATCH /api/posts/:id`

Trip owner only. Any of:
- `visitedOn`, `caption` (send `null` to clear it)
- `locationId` or `customLocationName` (sending one replaces the other, and sending both is a 400)
- `media`, which replaces the whole list. Items that are left out are deleted, including their S3 objects.

A post can't be moved to another trip.

Response `200`: `Post`. Errors: as in `POST`.

#### `DELETE /api/posts/:id`

Trip owner only. Permanently deletes the post and its media, including the S3 objects. Likes, saves, and comments on it go with it once those tables exist.

Response `204`. Errors: `403`, `404` as in `PATCH`.

#### `GET /api/trips/:id/posts`

Paginated `Post` list for the trip page, in trip order (`visitedOn`, then `createdAt`, oldest first).

Errors: `404` as in `GET /api/trips/:id`.

## Not in the MVP

Cut in DOC-1 (#33), and kept here so they don't get re-added by accident: trip and post visibility settings (`followers` / `private`), trip ratings, interest tags, tagging users in posts, several locations per post, posts without a trip, the `trip_items` join table, soft deletes, and unpublishing.

Grace's trip wireframes (#9) also have per-day titles and notes ("Day 3 · Beach day in Cascais"). DOC-1 doesn't include them, so they aren't in the schema. If we want them, that's a change to DOC-1 first, then a `trip_days` table here.
