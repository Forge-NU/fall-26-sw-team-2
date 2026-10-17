# Follower System

## Overview

The follower system defines the social relationships between users. Users can follow other users to see their content in the Following Feed and access their travel activity through their profiles. This document defines the follower data model and API contracts.

## Data Model

### Follow

The `follows` table represents a directional follow relationship between two users.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `follower_id` | String (Clerk user ID) | No | The user who initiates the follow |
| `following_id` | String (Clerk user ID) | No | The user being followed |
| `created_at` | Timestamp | No | When the follow relationship was created |

## Relationships and Constraints

### Relationships

- `follower_id` references `User.id` from #15.
- `following_id` references `User.id` from #15.
- A user can follow many users and can be followed by many users.
- Follow relationships are directional; user A following user B does not imply that user B follows user A.
- Both foreign keys use `ON DELETE CASCADE`. Deleting a user removes all follow relationships where that user is either the follower or the followed user.

### Constraints

- `(follower_id, following_id)` is the composite primary key, preventing duplicate follow relationships.
- A user cannot follow themselves. The API rejects self-follow requests, and a database CHECK constraint enforces `follower_id <> following_id`.
- `created_at` is required and defaults to the current timestamp.
- An index on `(following_id, follower_id)` supports follower-list queries.

## API Contracts

All follower endpoints require authentication. The backend identifies the current user through the Clerk authentication guard from #15, rather than accepting `follower_id` from the client.

### Follow User

**Endpoint**

`POST /api/users/:userId/follow`

Creates a follow relationship from the authenticated user to the specified user.

This operation is idempotent. If the relationship already exists, it returns the existing relationship without creating another row or changing `createdAt`.

**Path Parameters**

- `userId`: Clerk string ID of the user to follow.

**Request Body**

No request body is required.

**Response**

`201 Created`, including repeated follow requests.

```json
{
  "followerId": "user_alice",
  "followingId": "user_bob",
  "createdAt": "2026-09-30T12:00:00Z"
}
```

**Errors**

- `400 Bad Request` if the authenticated user attempts to follow themselves.
- `401 Unauthorized` if authentication fails.
- `404 Not Found` if the specified user does not exist.

### Unfollow User

**Endpoint**

`DELETE /api/users/:userId/follow`

Removes the follow relationship from the authenticated user to the specified user.

This operation is idempotent. If the relationship does not exist, the request still succeeds.

**Path Parameters**

- `userId`: Clerk string ID of the user to unfollow.

**Request Body**

No request body is required.

**Response**

`204 No Content`, including repeated unfollow requests.

**Errors**

- `401 Unauthorized` if authentication fails.
- `404 Not Found` if the specified user does not exist.

### Get Followers

**Endpoint**

`GET /api/users/:userId/followers`

Returns a paginated list of users who follow the specified user.

**Path Parameters**

- `userId`: Clerk string ID of the user whose followers are requested.

**Query Parameters**

- `cursor`: Optional opaque cursor returned by the previous page.
- `limit`: Optional page size.

Pages default to 20 users, with an integer limit from 1 to 100. Results are
ordered by user ID ascending. Cursors belong to a specific user and list
direction; invalid or mismatched cursors return 400.

**Response**

`200 OK`

```json
{
  "items": [
    {
      "id": "user_alice",
      "username": "alice",
      "firstName": "Alice",
      "lastName": "Wang",
      "avatarUrl": null,
      "isFollowing": true
    }
  ],
  "nextCursor": null
}
```

- `isFollowing` indicates whether the authenticated viewer follows the user in that row.
- `nextCursor` is used to request the next page. It is `null` when there are no more results.

**Errors**

- `400 Bad Request` for invalid pagination parameters.
- `401 Unauthorized` if authentication fails.
- `404 Not Found` if the specified user does not exist.

### Get Following

**Endpoint**

`GET /api/users/:userId/following`

Returns a paginated list of users followed by the specified user.

**Path Parameters**

- `userId`: Clerk string ID of the user whose following list is requested.

**Query Parameters**

Uses the same `cursor` and `limit` parameters as Get Followers.

**Response**

`200 OK`

Uses the same `{ items, nextCursor }` structure and user fields as Get Followers.

**Errors**

- `400 Bad Request` for invalid pagination parameters.
- `401 Unauthorized` if authentication fails.
- `404 Not Found` if the specified user does not exist.

### Get Follow Status

**Endpoint**

`GET /api/users/:userId/follow-status`

Returns whether the authenticated user follows the specified user.

**Path Parameters**

- `userId`: Clerk string ID of the user whose follow status is being requested.

**Response**

`200 OK`

```json
{
  "isFollowing": true
}
```

**Errors**

- `404 Not Found` if the specified user does not exist.

### Follower and Following Counts

**Endpoint**

`GET /api/me`

`GET /api/users/:id`

Both profile responses include counts. `id` is the Clerk user ID.
The planned `/api/users/:username` lookup requires integration with #29.

**Response Fields**

- `followerCount`: Number of users who follow this user.
- `followingCount`: Number of users this user follows.

Example fields within the profile response:

```json
{
  "followerCount": 12,
  "followingCount": 8
}
```

Counts reflect the current follow relationships. Following or unfollowing updates the relevant counts; repeated operations must not change them again.

## Pending Integrations

- **API-1 (#28):** Replace the local helper in `follow-pagination.ts` with the
  shared pagination helper and move the response contracts in
  `follow-list.types.ts` into shared-types. Adopt `@CurrentUser()` and the global
  API prefix when available, keeping existing URLs unchanged.
- **Account (#29):** Include counts in the username profile response by reusing
  `getCounts(user.id)`. Counts currently appear on `/api/me` and `/api/users/:id`.

## Validation

Run from `apps/api`:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand follows-http.e2e-spec.ts
```

HTTP tests cover authentication handling, status codes, validation and profile
counts using mocked Clerk responses and database operations.

For database tests, use a dedicated test database with migrations applied:

```bash
NODE_OPTIONS=--experimental-vm-modules FOLLOW_TEST_DATABASE_URL='<test database URL>' npm run test:e2e -- --runInBand follows.e2e-spec.ts
psql '<test database URL>' -v ON_ERROR_STOP=1 -f test/follows.constraints.sql
```

Database tests cover concurrent follow requests, repeated unfollow, count changes,
pagination, viewer-relative `isFollowing`, uniqueness, self-follow rejection and
cascading deletion.
