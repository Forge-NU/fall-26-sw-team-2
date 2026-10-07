# Authentication and User Data Architecture

## Overview

Yuji will use Clerk as the authentication provider. Clerk manages user authentication, credentials, and sessions, while the Yuji backend stores the application-specific user data needed by the product.

The backend uses the authenticated Clerk user ID to identify the current user. Clients do not provide a user ID when accessing their own account data.

## Authentication Provider

Clerk was selected because it provides managed authentication and integrates well with the project's NestJS backend and Expo mobile application. It also reduces the amount of authentication infrastructure Yuji needs to implement and maintain.

### Clerk owns

- Sign-in and sign-up flows
- Password and credential management
- Authentication sessions
- Authentication tokens
- Provider-managed identity information

Yuji does not store passwords, password hashes, or Clerk session secrets in its database.

### Yuji owns

The local `User` record stores data needed by the application.

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | String (primary key) | No | The Clerk user ID (e.g. `user_123`). Used directly as the primary key so no mapping table is needed |
| `email` | String | No | User email, copied from Clerk at creation |
| `firstName` | String | No | User first name |
| `lastName` | String | No | User last name |
| `username` | String (unique) | No | Application username; unique |
| `avatarUrl` | String | Yes | Optional profile image URL |
| `createdAt` | DateTime | No | Account creation timestamp |
| `updatedAt` | DateTime | No | Last update timestamp |

The local database does not store authentication credentials or provider session information.

### Relationships

`User` is the root of the application data model. Any model that belongs to a user (for example pins or posts) should reference it with a foreign key:

| Relationship | Foreign key | Cardinality | Nullability |
|---|---|---|---|
| `<Resource>` belongs to `User` | `<Resource>.userId` → `User.id` | Many-to-one (one user owns many resources) | Non-null for owned content |

The `ON DELETE` behavior for these foreign keys (cascade vs. anonymize) depends on the account deletion decision described under [Open Questions](#open-questions).

## Authentication Flow

1. The user signs in through Clerk.
2. Clerk provides the authenticated session.
3. The client sends authenticated requests to the Yuji API.
4. The backend validates the Clerk session using the authentication guard.
5. The backend obtains the authenticated Clerk user ID from the validated session.
6. The backend uses that ID to retrieve the corresponding local `User` record.
7. Application data is accessed using the local user record.

The backend derives the current user from the authenticated session rather than trusting a user ID supplied by the client.

## Sign Up, Login, and Sign Out

Sign up, login, and sign out are handled entirely by Clerk through its client SDK in the Expo app. The Yuji backend does not need to expose endpoints for these actions. The backend only validates the resulting session on each request.

## Middleware

A Clerk authentication guard protects all authenticated routes. It validates the Clerk session and attaches the Clerk user ID to the request. Requests without a valid session receive `401 Unauthorized`.

Required configuration (environment variables) includes the Clerk secret key and, for webhooks, the Clerk webhook signing secret. These must be set for local development and tests.

## API Contracts

### GET `/api/me`

Returns the currently authenticated user's application profile.

**Authentication:** Required. The backend derives the user ID from the authenticated Clerk session.

**Success: 200**

```json
{
  "id": "user_123",
  "firstName": "Example",
  "lastName": "User",
  "username": "exampleuser",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Unauthorized: 401**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Not Found: 404**

```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

### PATCH `/api/me`

Updates fields owned by the Yuji application.

**Authentication:** Required.

**Allowed fields:**

- `firstName`
- `lastName`
- `username`
- `avatarUrl`

All fields are optional; only the fields provided are updated. The client cannot modify the user's ID, authentication credentials, or authentication session information.

**Example request**

```json
{
  "firstName": "Example",
  "lastName": "User",
  "username": "exampleuser",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Success: 200**

Returns the updated profile, in the same shape as `GET /api/me`.

```json
{
  "id": "user_123",
  "firstName": "Example",
  "lastName": "User",
  "username": "exampleuser",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Bad Request: 400**

Returned when a field fails validation or an unknown field is sent.

```json
{
  "statusCode": 400,
  "message": ["username must be a string"],
  "error": "Bad Request"
}
```

**Unauthorized: 401**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Not Found: 404**

```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

**Conflict: 409**

Returned when the requested `username` is already taken.

```json
{
  "statusCode": 409,
  "message": "Username already in use"
}
```

### DELETE `/api/me`

Deletes the currently authenticated user's Yuji account.

**Authentication:** Required. The backend derives the user ID from the authenticated Clerk session.

The final deletion behavior must coordinate local database deletion with the Clerk account lifecycle. The implementation should define whether the Clerk account is deleted immediately or whether deletion is handled through a deferred/anonymization process.

**Success: 204**

No response body.

**Unauthorized: 401**

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Not Found: 404**

```json
{
  "statusCode": 404,
  "message": "User not found"
}
```

## Clerk Webhooks

A Clerk webhook endpoint may be added if Yuji needs to synchronize provider-side user lifecycle changes with the local database.

**Potential endpoint:** `POST /api/webhooks/clerk`

If implemented, webhook requests must:

- Verify the Clerk webhook signature.
- Handle create, update, and delete events as needed.
- Be idempotent.
- Tolerate retries and out-of-order events.

Webhooks are not a replacement for validating authentication on normal API requests.

## Endpoint Priority

| Priority | Item | Reason |
|---|---|---|
| P0 | Clerk authentication guard | Required by every other endpoint |
| P0 | Local `User` model and creation of the local row | `GET /api/me` depends on it |
| P0 | `GET /api/me` | Client needs the current user's profile |
| P1 | `PATCH /api/me` | Profile editing 
| P1 | `POST /api/webhooks/clerk` | Keeps local data in sync; may also create users (see Open Questions) |
| P2 | `DELETE /api/me` | Depends on the deletion decision |

## Implementation Plan

1. Keep Clerk responsible for authentication and session management.
2. Store the authenticated Clerk user ID and application-specific profile data in the local `User` table.
3. Protect authenticated endpoints with a Clerk authentication guard.
4. Derive the current user from the validated Clerk session.
5. Implement the `/api/me` endpoints for reading and updating the current user's application profile.
6. Define and implement account deletion behavior.
7. Add Clerk webhooks only if local user synchronization is required.
8. Add integration tests for authenticated and unauthenticated API requests.

## Next steps


1. **How is the local `User` row created?**
   - **Webhook:** create the row on the Clerk `user.created` event.
   - **Lazy creation:** create the row on the first authenticated request.
   
   Until this is decided, `GET /api/me` returns `404` for a Clerk user with no local row.

2. **How is account deletion handled?**
   - **Immediate hard delete:** delete the Clerk user through Clerk's backend API, then delete the local row and cascade to owned data.
   - **Deferred/anonymization:** mark the account deleted, strip personal fields (`email`, names, `username`, `avatarUrl`), keep the row so other users' content does not break, and delete the Clerk user.

3. **How do webhooks interact with `DELETE /api/me`?** Deleting the Clerk user triggers a `user.deleted` webhook. The handler must treat an already-deleted local user as success.