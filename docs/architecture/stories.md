# Stories

Status: Built, in review
Issue: #23 (STORY-1)

## Overview

This doc covers the `stories` table, the story endpoints, and the job that deletes expired stories. The story composer (#24 STORY-2) and the stories bar and viewer (#25 STORY-3) build on it.

The product rules come from DOC-1 (#33): [`docs/product/mvp-decisions.md`](../product/mvp-decisions.md#stories), and the cross-feature data model is in [`data-model.md`](data-model.md#stories). If this doc disagrees with DOC-1, DOC-1 wins and this doc should be fixed.

The rules, in short:
- A story is one photo, with optional text (up to 200 characters) and an optional location.
- Linking a trip is optional, but only one of the user's **active** trips can be linked: a draft where today is between its start and end dates.
- Every story is visible to everyone for 24 hours. The server enforces this.
- **Add to trip** (`keepOnTrip`) keeps the story on the trip page after it expires. Any other story is deleted after 24 hours, along with its S3 object.
- The owner can delete a story at any time. Deleting a trip deletes its stories, and deleting an account deletes the user's stories.

Related work:
- #3 DB-1 / #56 TRIP-1: `trips`, and the active-trip and visibility rules (`trips/trip-rules.ts`).
- #38 MEDIA-1: the presigned upload that produces the S3 keys stories reference.
- #10 FOL-1: the `follows` table. The stories bar is waiting on it (see [the stories bar](#get-apistoriesfeed)).
- #34 INF-1: the AWS setup for the cleanup schedule (see [Cleanup job](#cleanup-job)).

Shared code is copied unchanged from Duke's open PRs (#56, #57) until they merge: `common/` (dates, character length, trim, user summary, pagination), `storage/`, `trips/trip-rules.ts`, `trips/trip-locks.ts`, and `test/utils/test-app.ts`.

## Data model

### stories

Model: `apps/api/prisma/models/story.prisma`. Migration: `20261017050559_add_stories`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | No | `uuid()` | Primary key |
| `owner_id` | String | No | | FK → `User.id`, cascade |
| `trip_id` | UUID | Yes | | FK → `trips.id`, cascade. Only an active trip, checked by the API |
| `location_id` | UUID | Yes | | FK → `locations.id`, restrict |
| `custom_location_name` | VARCHAR(100) | Yes | | A name with no Mapbox place, as on posts |
| `s3_key` | String | No | | Unique. Under `users/{ownerId}/stories/` |
| `text` | VARCHAR(200) | Yes | | |
| `keep_on_trip` | Boolean | No | `false` | "Add to trip" |
| `expires_at` | Timestamp | No | `now() + 24 hours` | |
| `created_at` | Timestamp | No | `now()` | |

Check constraints (raw SQL at the end of the migration):
- `stories_keep_on_trip_check`: `NOT keep_on_trip OR trip_id IS NOT NULL`. Only a story with a trip can be kept.
- `stories_location_check`: `location_id IS NULL OR custom_location_name IS NULL`. At most one kind of location.

Indexes:
- `(owner_id, expires_at)`: one user's active stories. The stories bar uses it once it's limited to followed users.
- `(trip_id, created_at)`: kept stories on a trip page.
- `(expires_at)`: the stories bar while it lists everyone, and the cleanup job.
- `s3_key` unique: two stories can never share an object, so deleting one never removes another's photo.

#### Timestamps

Every expiry check compares against the database's clock (`now()`), never an app server's. Story create reads `now()` from the database inside its transaction, and sets `created_at` to it and `expires_at` to it plus 24 hours. That makes a story's lifetime exactly 24 hours. (Prisma would otherwise fill `created_at` from the app server's clock.) The `expires_at` default covers rows inserted directly, such as the seed.

Columns are `timestamp without time zone` in UTC, the same as the rest of the schema. That relies on the database time zone being UTC, which is the default for both the Docker image and RDS.

### Deletion

| Foreign key | On delete |
|---|---|
| `stories.owner_id` → `User` | Cascade |
| `stories.trip_id` → `trips` | Cascade (stories on a deleted trip are deleted, not unlinked) |
| `stories.location_id` → `locations` | Restrict (locations are shared and never deleted) |

Cascades remove rows, not S3 objects. Every delete that removes stories has to delete their objects too:
- `DELETE /api/stories/:id` and the cleanup job do this.
- **Trip delete (#56):** needs to read the trip's `stories.s3_key` values before deleting, alongside the `post_media` keys. Whichever of #56 and this PR merges second adds it.
- **Account delete (#15):** doesn't delete any S3 objects yet. The prefix delete of `users/{userId}/` suggested in [data-model.md](data-model.md#account-deletion) would cover stories.

## Visibility

- **Active story** (`expires_at > now()`): visible to everyone in the stories bar, including when its trip is still a draft.
- **Expired and kept:** visible only on its trip's page, to whoever can see the trip (`canViewTrip`: anyone once the trip is published, otherwise only the owner).
- **Expired and not kept:** never returned. The cleanup job deletes it.

Reads filter on `expires_at` themselves, so a story disappears on time even if the cleanup job hasn't run yet.

## API

Every endpoint needs a signed-in user (`ClerkAuthGuard`). Errors use NestJS's default shape, the same as the trip and post endpoints.

### Response shapes

TypeScript types in `apps/api/src/stories/story.types.ts`. They move into `shared-types` once API-1 (#28) adds it.

```ts
type StoryResponse = {
  id: string;
  owner: UserSummary;            // { id, username, firstName, lastName, avatarUrl }
  tripId: string | null;
  text: string | null;
  location: StoryLocationResponse | null; // same shape as a post's location
  customLocationName: string | null;
  imageUrl: string;              // presigned S3 GET URL, valid for 1 hour
  keepOnTrip: boolean;
  expiresAt: string;             // ISO 8601
  createdAt: string;
};

type StoryGroup = { owner: UserSummary; stories: StoryResponse[] };

type StoriesFeedResponse = { items: StoryGroup[]; nextCursor: string | null };
type TripStoriesResponse = { items: StoryResponse[]; nextCursor: string | null };
```

### `POST /api/stories`

Creates a story. Returns `201` with a `StoryResponse`.

```json
{
  "s3Key": "users/user_123/stories/uuid.jpg",
  "tripId": "…",
  "keepOnTrip": true,
  "text": "Pena Palace in the fog",
  "locationId": "…",
  "date": "2026-10-17"
}
```

- `s3Key` (required): has to start with `users/{userId}/stories/` (the key scheme from #38), and can't already belong to another story. The API doesn't check that the object exists yet.
- `tripId` (optional): has to be one of the user's active trips. The trip row is locked while the story is created, so the trip can't be published, deleted, or have its dates changed between the check and the insert.
- `keepOnTrip` (optional, default `false`): needs a `tripId`.
- `text` (optional): up to 200 characters, counted the way Postgres counts them. An empty string is stored as null.
- `locationId` or `customLocationName` (optional): at most one. `customLocationName` is 1 to 100 characters after trimming.
- `date` (optional): the user's local date (`YYYY-MM-DD`), used for "today" in the active-trip check. It has to be within a day of the server's UTC date. Without it, the server's UTC date is used.

Errors:
- `400`: bad fields, both location fields sent, `keepOnTrip` without a trip, a key outside the user's stories prefix or already in use, an unknown `locationId`, or a trip that isn't active (published, or today outside its dates).
- `403`: someone else's published trip.
- `404`: a trip that doesn't exist, or someone else's draft trip.

### `DELETE /api/stories/:id`

Owner only. Deletes the story and its S3 object. Returns `204`. Anyone else gets `404`, the same as a story that doesn't exist. If the S3 delete fails, the failure is logged and the delete still succeeds.

### `GET /api/stories/feed`

The stories bar. Returns `StoriesFeedResponse`: users with active stories, the user with the most recent story first, each with their active stories oldest first (the order a viewer taps through them).

- **Waiting for FOL-1 (#10):** this lists everyone's active stories for now, which is acceptable because everything is public. Once the `follows` table lands, it should be limited to the viewer and the users they follow. The spot is marked `TODO(FOL-1 #10)` in `stories.service.ts`.
- Pages through users, not stories: `?limit=<1-50, default 20>&cursor=<nextCursor>`. The cursor is an opaque string. A cursor the API didn't produce returns `400`.

### `GET /api/trips/:id/stories`

Stories kept on a trip, oldest first, including ones that have expired. Returns `TripStoriesResponse`. Returns `404` if the trip doesn't exist or the viewer can't see it (someone else's draft). It uses the standard pagination: `?cursor=<story id>&limit=<1-50>`.

## Cleanup job

`StoriesCleanupService.deleteExpired()` (`src/stories/stories-cleanup.service.ts`) deletes stories where `expires_at <= now()` and `keep_on_trip` is false, then deletes their S3 objects:

1. Deletes up to 1,000 rows (the S3 `DeleteObjects` limit) with a single `DELETE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING s3_key`.
2. Deletes those objects from S3. If that fails, it logs the keys and the row deletes stand. An object with no row is harmless, while a row with no object would be a broken image.
3. Repeats until a batch comes back short.

`SKIP LOCKED` means two runs at once never pick the same rows, so an overlapping schedule is safe.

### Running it

- **Locally:** `npm run stories:cleanup:dev` (reads `apps/api/.env`). Without `S3_BUCKET_NAME`, it deletes rows and logs that it skipped S3.
- **Built:** `npm run build`, then `npm run stories:cleanup` (`node dist/stories/cleanup.main`). This expects the environment variables to be set already, as they are in ECS.

The script starts only `PrismaModule`, `StorageModule`, and the cleanup service. It doesn't start the HTTP server or need Clerk.

### AWS setup (for #34 INF-1)

Nothing in AWS is needed to build or test this. To run the cleanup in production:

1. **Task:** reuse the API's ECS task definition, overriding the container command with `["node", "dist/stories/cleanup.main"]`. It needs the same `DATABASE_URL`, `AWS_REGION`, and `S3_BUCKET_NAME` as the API.
2. **Schedule:** an EventBridge Scheduler schedule, `rate(1 hour)`, targeting ECS `RunTask` on the API's cluster with the Fargate launch type, in the same subnets and security groups as the API (it has to reach RDS).
3. **IAM:**
   - The task role needs `s3:DeleteObject` on `arn:aws:s3:::<media bucket>/users/*`.
   - The scheduler's execution role needs `ecs:RunTask` on the task definition, and `iam:PassRole` for the task role and the task execution role.
4. **Logs:** the task writes `Deleted N expired stories`, and any S3 keys it failed to delete, to the task's CloudWatch log group.

Running hourly means a non-kept story's object can outlive the story by up to an hour. The story itself still disappears on time, because reads filter on `expires_at`.

## Seed data

`prisma/seed.ts` adds 4 stories, timed relative to when the seed runs:
- Alex: 2 stories on the active trip "Sintra and the coast", one kept and one not.
- Priya: 1 story with no trip, with a custom location.
- Maya: 1 story created **25 hours ago**, not kept (`00000000-0000-4000-c000-000000000004`). It never shows in the stories bar, and the cleanup job deletes it. Run the seed again to bring it back.

## Tests

- **Unit** (`npm test`, run in CI):
  - `stories.service.spec.ts`: trip linking (active, published, outside its dates, the user's local date, other users' trips), keys, locations, delete, feed grouping and cursors, and trip-page visibility.
  - `stories-cleanup.service.spec.ts`: what gets deleted, batching, and stopping.
  - `create-story.dto.spec.ts`: field validation.
- **E2E** (`npm run test:e2e`, against the local Postgres from `docker compose up -d`; not run in CI yet) in `test/stories.e2e-spec.ts`:
  - **Acceptance criteria:** a story created 25 hours ago never appears in the stories bar; the cleanup job removes both the row and the S3 object; and linking a published trip, or one whose dates don't include today, is rejected.
  - **Also:** the check constraint, cascades from trip and user deletes, kept stories on the trip page, delete permissions, and feed pagination.

## Not in the MVP

- Video stories, and tracking who viewed a story
- Limiting the stories bar to followed users (waiting for #10, not a product cut)
- Checking that an uploaded object exists, and sweeping uploads that never became a story (#38)
