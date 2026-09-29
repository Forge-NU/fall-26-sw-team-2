# Authentication Architecture

## Overview

The proposed authentication architecture for the application. It covers the selection of an authentication provider, the data that will be managed by the provider versus stored in our database, the local user data model, authentication API contracts, middleware requirements, and the implementation plan.

---

## Auth Provider

**Selected provider:** Clerk
- Most compatible with our tech stack and it seems like it will be less complicated to implement which means it will probably be faster for implementation
- Clerk provides managed sign-in, user profiles, server-only metadata, and lifecycle webhooks
- Its documentation supports storing the Clerk user ID and only the extra application data we need in our own database.
- The only drawback is that it seems harder to have an organization within it (i.e sign on to organization), so if we want like SSO or something for northeastern students, Auth0 would be a better choice, however I don't think we really need/want this so I think Clerk will work for our purposes. 


### Responsibilities

#### Auth Provider Manages

- Passwords and authentication credentials
- Sign-in methods
- Recovery and password reset flows
- Email verification
- Authentication sessions
- Provider-managed user identity
- Provider user profiles
- Provider lifecycle events

#### Our Application Manages

- Internal user ID
- Application-specific account lifecycle information
- Product preferences
- Application-specific profile fields
- Billing references
- Domain-specific relationships

### Provider-to-Application User Mapping

Clerk's stable user ID will be stored in our local 'users' table as 'auth_provider_user_id'. The local user record will have its own internal user UUID primary key. Application tables will reference the internal 'uses.id' instead of the provider ID or email address. 
Emails used for sign in should not be used as a relational key. 
---

## Data Model

### User

The application should maintain a local `users` record for associating authenticated users with application-specific data.

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | UUID | No | Generated | Primary key | Internal application user ID |
| `auth_provider` | String | No | `clerk` | — | Authentication provider name |
| `auth_provider_user_id` | String | No | — | Unique with `auth_provider` | User ID issued by the authentication provider |
| `created_at` | Timestamp | No | Current timestamp | — | Time the local account was created |
| `updated_at` | Timestamp | No | Current timestamp | — | Time the local account was last updated |
| `deleted_at` | Timestamp | Yes | `NULL` | — | Used if soft deletion or audit retention is required |
| `display_name` | String | Yes | `NULL` | — | Optional application-owned display name |

### Relationships

Application tables should reference the internal `users.id`.

- `users.id` is the primary key for the local user record.
- `auth_provider_user_id` identifies the corresponding user in the authentication provider.
- `auth_provider` and `auth_provider_user_id` should be unique together.
- Application tables should use `users.id` as their foreign key rather than email or the provider user ID.

### Data Ownership

The local user record should contain only information required by the application.
Passwords, password hashes, provider session secrets, and other authentication credentials should not be stored in the application database.


| Data | System | Application |
|---|---|---|
| Passwords, sign-in methods, recovery, email verification | Stored with Clerk | Validate provider-issued sessions on protected backend requests |
| User ID | Issued by Clerk | Store locally as a unique reference for associating application data with the authenticated person |
| Profile information such as email, verified state, name, and profile picture | Managed by Clerk | Read from verified authentication context when needed; copy locally only when a specific product requirement requires it |
| Application account and lifecycle timestamps | — | Store internal user ID and account creation/update state |
| Product preferences, application-specific profile fields, billing references, and domain relationships | — | Store in our database with appropriate validation and access controls |

**Principle:** Clerk metadata should remain small and related to identity or access. Queryable product data belongs in our application database.

### Nullability

Required fields:
- `id`
- `auth_provider`
- `auth_provider_user_id`
- `created_at`
- `updated_at`

Optional fields:
- `deleted_at`
- `display_name`
- Other application-specific fields when product requirements are confirmed

---

## Authentication Flows

### Sign Up

Clerk should handle the user's sign-up and credential management.

1. The user starts the sign-up flow through Clerk.
2. Clerk creates and manages the authenticated user.
3. The client receives the provider-managed authenticated session.
4. The backend validates the provider session on authenticated requests.
5. The backend resolves the Clerk user ID to the corresponding local `users` record.
6. If a local user does not exist, the application can create the local user record idempotently.

### Login
1. The user authenticates through Clerk.
2. Clerk validates the user's credentials and establishes an authenticated session.
3. The client sends authenticated requests to the backend.
4. Authentication middleware validates the provider-issued session.
5. The backend resolves the provider user ID to the internal `users.id`.
6. Application handlers use the normalized authenticated principal rather than trusting user identity supplied directly by the client.

### Sign Out

Sign-out should be handled through the authentication provider's session management.

1. The client requests sign-out through Clerk.
2. Clerk invalidates the appropriate authentication session.
3. Subsequent protected API requests without a valid session are rejected.


### Session / Token Verification

Authentication middleware validates the provider-issued session on protected backend requests. The backend should never trust a user ID simply because it was included in a client request.

The backend should:

1. Extract the provider authentication information from the request.
2. Validate the provider-issued session.
3. Retrieve the trusted provider user ID.
4. Resolve the provider user ID to the local internal user ID.
5. Pass a normalized authenticated principal to application code.

### Account Creation / User Synchronization

If the application maintains a local user projection:

1. A user is created in Clerk.
2. The application receives the relevant lifecycle event or encounters the authenticated user for the first time.
3. The application creates the local user record if one does not already exist.
4. User creation must be idempotent so repeated events or requests do not create duplicate users.

---

## API Contracts
Authentication itself is primarily managed by Clerk. The backend API should expose application-level endpoints for interacting with the authenticated user's application data. The backend should validate the Clerk session before allowing access to protected endpoints.

Sign-up, login, and sign-out are handled through Clerk rather than through custom `/auth/signup`, `/auth/login`, or `/auth/logout` endpoints in our backend. The backend is responsible for validating the authenticated session and associating the authenticated Clerk user with the corresponding local application user.

### Sign Up

Sign-up is handled by Clerk. The mobile application uses Clerk's authentication flow to create the user's authentication account and establish an authenticated session. The backend does not receive or store the user's password or password hash. After authentication, the backend uses the authenticated Clerk user ID to resolve or create the corresponding local `users` record.

### Login

Login is handled by Clerk. The mobile application uses Clerk's authentication flow to authenticate the user and establish a session. For subsequent protected API requests, the client provides the Clerk authentication session/token. The backend validates the session through authentication middleware before processing the request.

### Sign Out

Sign-out is handled by Clerk's session management. The client ends the authenticated Clerk session. Subsequent requests without a valid authentication session are rejected by the backend authentication middleware.

### Get Current User
Endpoints 

GET /api/me
- Returns the authenticated user’s application profile

Response:
{
  "id": "uuid",
  "displayName": "Lucy",
  "createdAt": "2026-09-29T12:00:00Z"
}

PATCH /api/me 
- Updates explicitly user-editable, application-owned fields. displayName is a possible initial field, pending product confirmation.
- Reject server-owned fields such as id, roles, authProviderUserId, createdAt, and billing identifiers.

Request:
{
  "displayName": "Lucy Shah"
}

Response:
{
  "id": "uuid",
  "displayName": "Lucy Shah",
  "updatedAt": "2026-09-29T12:30:00Z"
}

DELETE /api/me
- If account deletion is in scope, decide whether to delete the provider account immediately, mark it for deletion, or anonymize local data. 
- Define how related application records and retention requirements are handled.

{
  "status": "deletion_pending"
}

POST /api/webhooks/clerk 
- only if local synchronization is needed
- If we keep a local user projection, handle provider lifecycle events such as user creation, update, and deletion. Verify webhook signatures, make event handling idempotent, and allow for retries and out-of-order delivery.
- Webhooks handle asynchronous lifecycle updates. They should not replace request-time session validation.

{
  "received": true
}

## Middleware

Protected backend endpoints should use authentication middleware to validate the Clerk session before the request reaches application handlers.

The middleware should:
1. Extract authentication information from the incoming request.
2. Validate the Clerk session.
3. Retrieve the trusted Clerk user ID.
4. Resolve the Clerk user ID to the local users.id.
5. Attach a normalized authenticated principal to the request.
6. Reject the request with 401 Unauthorized if authentication fails.

Application handlers should use this authenticated principal rather than accepting a user ID directly from the request body or URL when the operation concerns the currently authenticated user.

---
## Implementation Plan

1. **Confirm authentication requirements**
   - Confirm required sign-in methods, email verification, roles/permissions, and whether enterprise SSO or organization support is needed.

2. **Finalize provider and data model**
   - Confirm Clerk as the authentication provider.
   - Approve the local `users` table and the fields that should be stored locally versus managed by Clerk.

3. **Implement authentication middleware**
   - Configure Clerk.
   - Validate provider sessions on protected API requests.
   - Resolve the Clerk user ID to the internal `users.id`.
   - Attach the authenticated user to the request.

4. **Implement user API endpoints**
   - Implement `GET /api/me`.
   - Implement `PATCH /api/me` for application-owned profile fields.
   - Implement account deletion after the deletion/retention policy is finalized.

5. **Implement user synchronization if needed**
   - Add the Clerk webhook endpoint if the application needs local user records to stay synchronized with Clerk.
   - Verify webhook signatures and make processing idempotent.

6. **Test authentication flows**
   - Test sign-up, login, sign-out, protected API requests, invalid/expired sessions, user creation, profile updates, and webhook handling.

7. **Finalize security and operational requirements**
   - Confirm secret management, roles/permissions, account deletion, data retention, and production configuration.