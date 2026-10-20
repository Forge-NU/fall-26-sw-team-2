# Mobile data layer

How screens in `apps/mobile` talk to the API: the API client, React Query,
infinite lists, mocks for endpoints that don't exist yet, and where sign-in
plugs in. Part of APP-1 (#30). For the API side (error shape, pagination,
shared-types), see [api-conventions.md](../architecture/api-conventions.md).

To see it all working, open `/api-examples` in a dev build or the browser
(`npm start`, then `w`). It's dev-only and not in the tab bar. It has two lists
built the same way, one per tab:

- **Mocked endpoint**: `src/api/examples.ts`, an endpoint wrapped in `withMock`,
  paged 20 at a time. Copy this one for an endpoint that isn't built yet.
- **Real API**: `src/api/users.ts`, API-1's `GET /api/users`. It returns 401 until
  sign-in lands with #29, so for now it shows the signed-out error.

Both use `useInfiniteList` and `src/components/dev/user-list.tsx`, which covers
every state an infinite list needs.

## Adding an endpoint

Put each resource's calls in `src/api/<resource>.ts`, typed with request and
response types from `shared-types`. Screens call these functions, never `fetch`.

```ts
// src/api/users.ts
import type { UserResponse } from 'shared-types';

import { apiGet, apiRequest } from '@/api/client';

export function getUser(id: string): Promise<UserResponse> {
  return apiGet(`/api/users/${encodeURIComponent(id)}`);
}

export function updateMe(body: { firstName?: string; lastName?: string }): Promise<UserResponse> {
  return apiRequest('PATCH', '/api/me', body);
}
```

`apiGet(path, query)` leaves `null` and `undefined` query values out of the URL.
`apiRequest(method, path, body)` sends `body` as JSON. Both send the signed-in
user's token and resolve to `undefined` for an empty response, such as a 204.

## Errors

A non-2xx response throws an `ApiError` with `status` and the API's error body
(`body: ApiErrorResponse | null`, from shared-types). A request that never gets
a response (no internet, server down) throws fetch's own `TypeError` instead, so
retry logic can tell "the server said no" from "we don't know if it arrived".

`getErrorMessage(error)` turns either one into text for the user.

## React Query

The app is wrapped in a `QueryClientProvider` (`src/lib/query-client.ts`). Use
`useQuery` for reads and `useMutation` for writes. Defaults:

- Data is fresh for 30 seconds.
- Failed reads retry up to twice, except 4xx errors, which won't change on a retry.

Error toasts are shown once per failure, after retries:

| | Toasts by default | Turn it off | Force it on |
|---|---|---|---|
| Mutation fails | Yes | `meta: { toast: false }` | |
| Query's first load fails | No (show an error state on the screen) | | `meta: { toast: true }` |
| Query refetch fails while older data is on screen | Yes | `meta: { toast: false }` | |

Turn the toast off when the screen shows the error itself, such as an inline
form error. Outside React Query, call `showToast` from `@/lib/toast` with
`getErrorMessage(error)`.

## Infinite lists

`useInfiniteList` (`src/hooks/use-infinite-list.ts`) works with any endpoint that
returns `PaginatedResponse<T>` (`{ items, nextCursor }`). `items` holds every page
loaded so far.

```tsx
const users = useInfiniteList({
  queryKey: ['users'],
  fetchPage: (cursor, signal) => apiGet<PaginatedResponse<UserResponse>>(
    '/api/users', { cursor, limit: 20 }, { signal },
  ),
});

<FlatList
  data={users.items}
  keyExtractor={(user) => user.id}
  renderItem={({ item }) => <UserRow user={item} />}
  onEndReached={users.loadMore}
  refreshing={users.isRefetching}
  onRefresh={() => void users.refetch()}
/>
```

It also returns everything `useInfiniteQuery` does (`isPending`, `isError`,
`isFetchingNextPage`, `fetchNextPage` and so on). After a page fails, `loadMore`
stops trying so the list doesn't retry in a loop. Show a retry button that
calls `fetchNextPage()`.

## Mocking endpoints

When a screen needs an endpoint that isn't built yet, wrap it with `withMock`
from `src/api/mock.ts`. The mock takes the same arguments and returns the same
shared-types response as the real call, so the screen doesn't change when the
endpoint ships.

```ts
// src/api/saved.ts
import type { PaginatedResponse, SavedItineraryResponse } from 'shared-types';

import { apiGet } from '@/api/client';
import { mockDelay, mockPage, withMock } from '@/api/mock';

const savedItineraries: SavedItineraryResponse[] = [/* ... */];

export const getSavedItineraries = withMock({
  live: false, // set to true once GET /api/me/saved is merged
  real: (cursor: string | null) =>
    apiGet<PaginatedResponse<SavedItineraryResponse>>('/api/me/saved', { cursor }),
  mock: async (cursor: string | null) => {
    await mockDelay();
    return mockPage(savedItineraries, cursor);
  },
});
```

Add the response type to `shared-types` first, the same way the API ticket
would, so both sides agree on the contract.

Helpers in `src/api/mock.ts`:

- `mockDelay(ms?)` waits about 400 ms, so loading states show up.
- `mockPage(items, cursor, limit?)` returns one page in the API's pagination shape.
- `mockError(status, message)` throws the same `ApiError` a real error response
  would, so you can try a screen's error states.

`EXPO_PUBLIC_API_MOCKS` in `.env` picks what's mocked:

- `auto` (default): only endpoints with `live: false`
- `all`: every endpoint that has a mock, e.g. for a demo without the API running
- `none`: no mocks, to try a new endpoint against your local API before setting `live: true`

Once an endpoint is live and nothing needs its mock, delete the `withMock`
wrapper and keep just the real call.

## Where sign-in plugs in (ACCT-1, #29)

Until #29 lands, the app acts as if it's always signed in, and requests go out
without a token. Endpoints behind `ClerkAuthGuard` return 401 until then. #29
fills in two places, both in `src/lib/auth.ts`, without changing navigation or
the API client:

1. **`useAuth()`** returns `{ isLoaded, isSignedIn }`. The `AuthGate` in the root
   layout (`src/components/auth-gate.tsx`) shows the tabs when signed in and a
   sign-in screen when not. Replace the body with Clerk's `useAuth()`, and
   replace the gate's placeholder sign-in screen with the real one.
2. **`setAuthTokenGetter(getter)`** sets where the API client gets its token.
   Register Clerk's `getToken` once from a component inside `ClerkProvider`:

   ```ts
   const { getToken } = useAuth(); // Clerk's
   useEffect(() => setAuthTokenGetter(getToken), [getToken]);
   ```
