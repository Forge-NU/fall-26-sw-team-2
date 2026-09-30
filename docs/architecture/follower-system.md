# Follower System

## Overview

The follower system defines the social relationships between users. Users can follow other users to see their content in the Following Feed and access their travel activity through their profiles. This document defines the follower data model and API contracts. 

## Data Model

### Follow

The `follows` table represents a directional follow relationship between two users.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `follower_id` | UUID | No | The user who initiates the follow |
| `following_id` | UUID | No | The user being followed |
| `created_at` | Timestamp | No | When the follow relationship was created |

## Relationships and Constraints

### Relationships

- `follower_id` references `users.id`.
- `following_id` references `users.id`.
- A user can follow many users and can be followed by many users.
- Follow relationships are directional; user A following user B does not imply that user B follows user A.

### Constraints

- The combination of `follower_id` and `following_id` must be unique to prevent duplicate follow relationships.
- A user cannot follow themselves (`follower_id != following_id`).
- Both `follower_id` and `following_id` are required and cannot be null.
- `created_at` is required and should default to the current timestamp.

## API Contracts

All follower endpoints require authentication. The backend should identify the current user through the authenticated user context defined in #4 rather than accepting `follower_id` from the client.

### Follow User

**Endpoint**

`POST /api/users/:userId/follow`

Creates a follow relationship from the authenticated user to the specified user.

**Path Parameters**

- `userId`: UUID of the user to follow.

**Request Body**

No request body is required.

**Response**

`201 Created`

```json
{
  "followerId": "uuid",
  "followingId": "uuid",
  "createdAt": "2026-09-30T12:00:00Z"
}
```

**Errors**

- `400 Bad Request` if the authenticated user attempts to follow themselves.
- `404 Not Found` if the specified user does not exist.
- `409 Conflict` if the follow relationship already exists.

### Unfollow User

**Endpoint**

`DELETE /api/users/:userId/follow`

Removes the follow relationship from the authenticated user to the specified user.

**Path Parameters**

- `userId`: UUID of the user to unfollow.

**Request Body**

No request body is required.

**Response**

`204 No Content`

**Errors**

- `404 Not Found` if the specified user or follow relationship does not exist.

### Get Followers

**Endpoint**

`GET /api/users/:userId/followers`

Returns the users who follow the specified user.

**Path Parameters**

- `userId`: UUID of the user whose followers are being requested.

**Response**

`200 OK`

```json
{
  "followers": [
    {
      "id": "uuid",
      "displayName": "Alice"
    },
    {
      "id": "uuid",
      "displayName": "Bob"
    }
  ]
}
```

**Errors**

- `404 Not Found` if the specified user does not exist.

### Get Following

**Endpoint**

`GET /api/users/:userId/following`

Returns the users followed by the specified user.

**Path Parameters**

- `userId`: UUID of the user whose following list is being requested.

**Response**

`200 OK`

```json
{
  "following": [
    {
      "id": "uuid",
      "displayName": "Alice"
    },
    {
      "id": "uuid",
      "displayName": "Charlie"
    }
  ]
}
```

**Errors**

- `404 Not Found` if the specified user does not exist.

### Get Follow Status

**Endpoint**

`GET /api/users/:userId/follow-status`

Returns whether the authenticated user follows the specified user.

**Path Parameters**

- `userId`: UUID of the user whose follow status is being requested.

**Response**

`200 OK`

```json
{
  "isFollowing": true
}
```

**Errors**

- `404 Not Found` if the specified user does not exist.

## Integration Notes

### User / Authentication (#4)

- `follower_id` and `following_id` reference the internal `users.id` defined in #4.
- Both fields use UUIDs to match the current user schema.
- Follow and unfollow operations use the authenticated user provided by the authentication middleware rather than accepting the acting user's ID from the client.
- User deletion behavior should follow the account deletion and retention policy finalized in #4.

### Trips / Posts (#3)

- The follower system defines relationships between users but does not define trip, post, or location data.
- Trip and post visibility rules can use follower relationships to determine whether content should be visible to the requesting user.
- The exact visibility levels and behavior should remain aligned with the contracts finalized in #3.
- The Following Feed can use follow relationships to identify content created by users that the authenticated user follows.

### Profile UI (#7)

- Profile screens may use follower data to display follower and following counts and lists.
- The UI may also require `isFollowing` to determine whether to display a Follow or Following state.
- Additional user fields needed in follower/following lists, such as profile images or usernames, should align with the profile and user schemas rather than being defined by the follower system.