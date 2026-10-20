# Authentication and onboarding

## Ownership

Clerk owns sign-up, sign-in, verification codes, credentials, and sessions. The mobile app uses Clerk's Expo SDK and SecureStore token cache. Yuji's API validates Clerk bearer tokens with `ClerkAuthGuard`; clients never send a user ID for `/api/me` operations.

## Sign-up and sign-in

- **Sign-up:** email plus a password (8+ characters), then a one-time code to verify the email.
- **Sign-in:** email or username plus the password. No code, except when Clerk's device trust asks for one on a new device; the app then sends an email code.
- **Forgot password:** a reset code to the email, then a new password.

Phone numbers aren't supported: SMS needs a paid Clerk plan. Adding them later means a phone option on sign-up and the SMS variants of the same Clerk calls.

Sign-in by username works because Yuji copies each username to the Clerk user (`clerkClient.users.updateUser`) when onboarding or `PATCH /api/me` sets it. The Clerk call runs inside the database transaction, so if Clerk rejects the name the Yuji row is unchanged. Yuji's database stays the source of truth for availability and lookups.

### Clerk Dashboard settings (User & authentication)

| Setting | Value |
| --- | --- |
| Email | Sign-up on, verify at sign-up with **email code**, sign-in on |
| Phone | Off |
| Password | **On**, required |
| Username | **On** for sign-in, **not required at sign-up** (the app sets it after onboarding) |
| First and last name | Off or optional; onboarding collects them |

If Clerk requires a field the app doesn't collect, the code step shows "Clerk also requires: …" naming it.

Yuji stores the app profile in `User`. A row is created by the Clerk `user.created` webhook. Both the webhook and onboarding (`POST /api/me/profile`) upsert on Clerk's user ID, so delivery retries, or onboarding finishing before the webhook arrives, cannot create a second row. The onboarding upsert is also the local-dev fallback: if no tunnel is running, the row is created when the user picks a username.

**Decision: `username` is nullable until onboarding** (rather than a placeholder). A webhook-created row has `username: null`, and the app treats a null username as "needs onboarding". Postgres allows many nulls under a unique index, and nothing has to avoid or clean up placeholder names. `email` is also nullable, so phone sign-ups (not enabled yet) can be added without a migration. First and last name start as empty strings when Clerk did not collect them and are set during onboarding.

Usernames are 4–30 letters, numbers, or underscores (Clerk's rules, since Clerk also stores them), trimmed and stored in lowercase. A PostgreSQL unique index on `lower(username)` enforces case-insensitive uniqueness, so `Christian` and `christian` cannot both be claimed. The onboarding screen checks availability while typing, but the database constraint remains authoritative during submission.

## Mobile routing and API requests

The root auth gate (`apps/mobile/src/components/auth-gate.tsx`) waits for Clerk to restore its persisted session. Signed-out users see the auth screen. After authentication, the app loads `GET /api/me`; a 404 (webhook still in flight) or a null username shows onboarding. Users with a username land in the app tabs, and the gate provides their profile to screens through `AuthGateContext`. The tabs are not rendered at all until a username is set, so no route inside them is reachable before onboarding. Sign-out calls Clerk, which clears the SecureStore token cache, and the gate drops its in-memory profile; the app keeps no other user data.

Authenticated API requests call Clerk `getToken()` and send `Authorization: Bearer <token>`. Session state is persisted in Expo SecureStore through Clerk's `tokenCache`; no session token is copied into app-managed storage.

## API contracts

### `GET /api/me`

Requires a valid Clerk token. Returns the current profile. A webhook-created user before onboarding receives `username: null`; no local row returns 404 while the webhook is in flight.

### `POST /api/me/profile`

Requires a valid Clerk token. Creates or completes the current user's profile with `firstName`, `lastName`, and `username`. This endpoint updates an incomplete webhook-created row. Username conflicts return 409.

### `GET /api/users/username-availability?username=<name>`

Requires a valid Clerk token. Returns `{ "available": boolean }` using a case-insensitive comparison.

### `GET /api/users/:username`

Requires a valid Clerk token. Looks up a profile by username, case-insensitively. The former ID lookup is available at `GET /api/users/id/:id`.

### `DELETE /api/me`

Requires a valid Clerk token. Removes the user's S3 objects, deletes the Clerk user, then deletes the local user row (related database records cascade). If S3 deletion fails, the API keeps the Clerk account and database rows so the request can be retried.

All protected routes return 401 when the bearer token is missing or invalid.

### Response types

`UserResponse` (with `username: string | null`) and `UsernameAvailabilityResponse` are exported from `shared-types`.

## Tests

- `apps/api/test/auth.e2e-spec.ts` runs the real `ClerkAuthGuard` against every protected route and expects 401 without a token or with an invalid one. Add new routes to its list.
- `apps/api/test/users.e2e-spec.ts` sends signed webhook deliveries (one row per sign-up, retries are no-ops) and covers onboarding, case-insensitive uniqueness, availability, username lookup, and account deletion across every table and S3.
- E2E tests need the local Postgres: `cd apps/api && docker compose up -d && npx prisma migrate deploy && npm run test:e2e`.

## Clerk webhook

The API accepts signed Clerk events at `POST /api/webhooks/clerk`. It verifies the Standard Webhooks signature against `CLERK_WEBHOOK_SIGNING_SECRET` using the raw request body. `user.created` and `user.updated` synchronize trusted email and avatar values; `user.deleted` removes the local row and cascaded data and attempts S3 cleanup. Unrelated Clerk events are acknowledged and ignored.

For local development, start the API and a Cloudflare Quick Tunnel in separate terminals:

```sh
cd apps/api && npm run start:dev
cloudflared tunnel --url http://localhost:3000
```

Copy the temporary HTTPS URL printed by `cloudflared`. In the Clerk Dashboard, add a webhook endpoint at `<tunnel-url>/api/webhooks/clerk`, select `user.created`, `user.updated`, and `user.deleted`, then copy the endpoint's signing secret into `apps/api/.env` as `CLERK_WEBHOOK_SIGNING_SECRET`. The Quick Tunnel URL changes when restarted, so update the Clerk endpoint URL each time. Quick Tunnels are intended for development and testing. The mobile app's `.env` needs `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL`; use the machine's LAN IP for a physical device.

## Local setup checklist

1. Copy the API and mobile `.env.example` files to `.env` and fill in Clerk keys.
2. Start Postgres and apply Prisma migrations as described in the root README.
3. Start the API and tunnel, then configure the Clerk webhook URL and signing secret.
4. Start Expo, sign up with an email and password, and choose a username.
5. Restart the app to confirm the session returns to the feed; sign out and confirm auth screens appear.

See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) for current tunnel setup and limitations.
