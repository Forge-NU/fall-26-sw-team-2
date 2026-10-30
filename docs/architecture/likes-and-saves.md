# Likes and Saves

Issue: #49 (INT-1)
Product rules: [`mvp-decisions.md`](../product/mvp-decisions.md#likes) (#33 DOC-1)
Unblocks: #51 (INT-3, likes and saves UI)

## Overview

- **Likes** are on posts. One like per user per post. Anyone who can see a post can see its like count and who liked it.
- **Saves** cover whole trips and individual posts. They show in the Saved tab on your own profile, and only you can see what you've saved.
- Liking, unliking, saving and unsaving are all idempotent. Double-tapping like makes one row, and unliking something you haven't liked succeeds.
- Post and trip responses carry the counts and whether the viewer has liked or saved them.

## Data Model

Three join tables, each keyed by the `(user, thing)` pair, following the [data model](data-model.md#post_likes-post_saves-trip_saves). The primary key is what makes "one like per user per post" hold, even when two requests race.

| Table | Primary key | Other indexes | Used by |
|---|---|---|---|
| `post_likes` | `(user_id, post_id)` | `(post_id, created_at, user_id)` | Who liked a post (newest first) and the post's like count |
| `post_saves` | `(user_id, post_id)` | `(user_id, created_at, post_id)`, `(post_id)` | The Saved tab, and the post's save count |
| `trip_saves` | `(user_id, trip_id)` | `(user_id, created_at, trip_id)`, `(trip_id)` | The Saved tab, and the trip's save count |

Each table also has `created_at`, which orders the lists. The primary key also answers "has the viewer liked or saved this".

Prisma models: `apps/api/prisma/models/post-like.prisma`, `post-save.prisma`, `trip-save.prisma`.

### Deletion

Every foreign key is `ON DELETE CASCADE` (decided in #33):

- Deleting an account deletes the user's likes and saves.
- Deleting a post deletes its likes and saves.
- Deleting a trip deletes its saves, and (through its posts) the likes and saves on its posts.

### Writes

- Like and save use `INSERT ... ON CONFLICT DO NOTHING` (Prisma's `createMany` with `skipDuplicates`). A second like, or two at once, leaves the one row and returns success.
- Unlike and unsave delete by the key without checking that the row exists.
- If the post or trip is deleted between the visibility check and the insert, the foreign key error is returned as 404.

## Visibility

Likes and saves follow the trip's visibility ([`trip-rules.ts`](../../apps/api/src/trips/trip-rules.ts)): a published trip and its posts can be seen by everyone, and a draft only by its owner.

- Liking, saving, or listing the likes of something you can't see returns 404, the same as reading it. A draft doesn't leak.
- An owner can like and save their own posts and trips, including drafts.
- The saved lists only ever return the caller's own saves. They're under `/api/me`, and there's no route that takes another user's ID. A cursor that isn't one of your saves returns 400, so you can't page into someone else's list.
- The saved lists also filter on visibility. Every saved item was visible when it was saved, and publishing can't be undone, so this is only a guard.

## API Contracts

All endpoints are under `/api` and need a Clerk session. Errors use the shared shape in [`api-conventions.md`](api-conventions.md#error-response-shape).

List endpoints use the cursor pagination in [`itinerary-schema.md`](itinerary-schema.md#api-contracts): `?cursor=<from the last page>&limit=<1-50, default 20>` returns `{ "items": [...], "nextCursor": "..." | null }`. A cursor that doesn't belong to the list returns 400. The helper (`apps/api/src/common/pagination.ts`) is the stand-in until API-2 (#90).

Response types are in `shared-types` (`LikeStatusResponse`, `PostLikerResponse`, `SaveStatusResponse`) and in `apps/api/src/likes/like.types.ts` and `saves/save.types.ts`.

### Counts on posts and trips

Every endpoint that returns a `Post` or `Trip` (see [`itinerary-schema.md`](itinerary-schema.md#shared-response-shapes)) now includes:

`Post`:
```json
{
  "likeCount": 12,
  "saveCount": 2,
  "likedByMe": true,
  "savedByMe": false
}
```

`Trip`:
```json
{
  "saveCount": 3,
  "savedByMe": false
}
```

`likedByMe` and `savedByMe` are for the user making the request.

### Likes

#### `POST /api/posts/:id/like`

Likes the post. Liking a post you already like is a no-op.

Response `200`:
```json
{ "liked": true, "likeCount": 12 }
```

Errors: `404` if the post doesn't exist or you can't see it.

#### `DELETE /api/posts/:id/like`

Removes your like. Unliking a post you don't like is a no-op.

Response `200`:
```json
{ "liked": false, "likeCount": 11 }
```

Errors: `404` as in `POST`.

Both return the new count so the app can correct an optimistic update.

#### `GET /api/posts/:id/likes`

Who liked the post, most recent like first. Paginated.

Response `200`:
```json
{
  "items": [
    {
      "id": "user_123",
      "username": "priya.shah",
      "firstName": "Priya",
      "lastName": "Shah",
      "avatarUrl": null,
      "isFollowing": true,
      "likedAt": "2026-10-20T12:00:00.000Z"
    }
  ],
  "nextCursor": "user_123" | null
}
```

- `isFollowing` is whether the viewer follows that user, for a follow button on the list.
- The cursor is the liker's user ID (a Clerk ID, not a UUID).

Errors: `404` as in `POST`, and `400` for a cursor that isn't a like on this post.

### Saves

#### `POST /api/trips/:id/save` and `POST /api/posts/:id/save`

Saves the trip or post. Saving something you've already saved is a no-op.

Response `200`:
```json
{ "saved": true, "saveCount": 3 }
```

Errors: `404` if the trip or post doesn't exist or you can't see it.

#### `DELETE /api/trips/:id/save` and `DELETE /api/posts/:id/save`

Removes the save. Unsaving something you haven't saved is a no-op.

Response `200`:
```json
{ "saved": false, "saveCount": 2 }
```

Errors: `404` as in `POST`.

#### `GET /api/me/saved/trips`

Your saved trips, most recently saved first. Paginated, and the cursor is a trip ID.

Response `200`: `{ "items": Trip[], "nextCursor": "uuid" | null }`

Errors: `400` for a cursor that isn't one of your saved trips.

#### `GET /api/me/saved/posts`

Your saved posts, most recently saved first. Paginated, and the cursor is a post ID.

Response `200`: `{ "items": Post[], "nextCursor": "uuid" | null }`

Errors: `400` for a cursor that isn't one of your saved posts.

## Seed data

`npx prisma db seed` adds likes on Maya's Lisbon posts and Priya's Copenhagen posts, plus saved trips and posts for each seed user. They're all on published trips, since nobody else can see a draft.

## Not in the MVP

- Notifications for likes (cut in #33).
- Showing who saved something. Only counts are returned.
