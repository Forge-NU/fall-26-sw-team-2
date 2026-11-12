# Locations: Mapbox Places and the Resolve Endpoint

Status: Built
Issues: #37 (LOC-1), #94 (LOC-2, dropped pins)

## Overview

One shared definition of a location, used by posts, stories, the map and search. The `locations` table itself is defined in [`itinerary-schema.md`](itinerary-schema.md#locations). This doc covers the endpoint that turns a place the user picked into something a post can reference.

Product rules are in DOC-1 ([`mvp-decisions.md`](../product/mvp-decisions.md#locations)), including the Mapbox storage terms. If this doc disagrees with DOC-1, DOC-1 wins.

Code: `apps/api/src/locations/`. Request and response types are in `apps/shared-types/src/locations.ts`.

## How a location gets onto a post

1. The app searches Mapbox directly. The user taps a result, or types a name Mapbox doesn't know and picks **Drop a pin** or **Just the name**.
2. The app sends it to `POST /api/locations/resolve`.
3. The app creates the post (`POST /api/posts`) or story (`POST /api/stories`) with either:
   - `locationId`: the `location.id` from a `mapbox` or `pin` result, or
   - `customLocationName`: the `name` from a `custom` result.

Three kinds of location:

| Kind | Stored as | Coordinates | On the map and in radius search | Place search | Rated |
|---|---|---|---|---|---|
| Mapbox place | A shared `locations` row, `provider = 'mapbox'`. Two posts at the same place share it. | Yes | Yes | Yes | Yes, averaged over every post there |
| Dropped pin | Its own `locations` row, `provider = 'custom'`, used by one post or story | Yes | Yes, labeled with the typed name | No | Yes, the one post's rating |
| Custom name | `posts.custom_location_name` / `stories.custom_location_name`, no row | No | No | No | No |

## Dropped pins

#94 (LOC-2). For a spot Mapbox doesn't list (a hidden beach, a trailhead, a friend's rooftop). The user types the name, taps **Drop a pin**, and pans a map under a fixed pin.

- **Never merged.** Every pin is a new row with a generated `provider_place_id`, even at the same name and coordinates. Two people's "secret beach" aren't the same place.
- **One owner, one use.** `locations.created_by` is the user who dropped it (null for Mapbox places). Only that user can attach it, and only to one post or story. Attaching someone else's pin, or a pin another post or story already uses, is a `400`. The check runs in the post or story transaction and locks the pin row `FOR UPDATE`, so two requests can't both take the same pin. Mapbox places aren't locked (`assertCanAttachLocation` in `apps/api/src/locations/custom-locations.ts`).
- **Deleted with its post or story.** The `delete_unused_custom_location` trigger on `posts` and `stories` (migration `20261112120000_custom_location_pins`) deletes the pin, in the same transaction, once its post or story stops using it: deleted, deleted by a cascade (trip or account deleted), an expired story removed by the cleanup job, or a post edited to another location. A trigger rather than app code so the cascades that never reach the app are covered. It only deletes `provider = 'custom'` rows that nothing references, so Mapbox places are never deleted.
- **Unused pins.** A pin is created when the user confirms it, before the post exists. If the composer is abandoned, the hourly stories cleanup job deletes pins over 24 hours old that no post or story uses (`StoriesCleanupService.deleteUnusedPins`). Account deletion deletes the user's unused pins right away. A post draft retried after its pin was cleaned up gets `Location not found`, and the app drops the same pin again and retries.
- **Public.** A pin is as public as its post or story. The app shows "Anyone can see this pin." before Confirm.
- **Search.** Post and trip radius filters (#93 SRCH-3) join `locations`, so they include pins. Place search (`type=places`) filters `provider <> 'custom'`, since a pin is a personal spot, not a shared place.
- **Ratings.** A post with a pin has a `location_id`, so it can be rated (RATE-1), and the pin's `rating` is that post's. A post with only a custom name still can't be rated.
- **Map (MAP-2, #46).** Not built yet. The viewport and location detail queries should treat pins like any other `locations` row: include `provider = 'custom'` rows, and label them with `name` (the typed name). A pin's location page only ever has its one post. Posts with only a custom name have no coordinates and stay off the map.

## `POST /api/locations/resolve`

Auth: signed in (`ClerkAuthGuard`). Otherwise `401`.

Finds the `locations` row for a Mapbox place, creating it if needed. For a dropped pin, always creates a new row owned by the caller. For a custom name, it validates the name and returns it without writing anything.

### Request

Mapbox place: send the fields from the Search Box result the user tapped.

```json
{
  "kind": "mapbox",
  "mapboxId": "dXJuOm1ieHBvaTo...",
  "name": "Pastéis de Belém",
  "latitude": 38.697464,
  "longitude": -9.203213,
  "address": "R. de Belém 84-92, 1300-085 Lisboa",
  "city": "Lisbon",
  "region": "Lisbon",
  "countryCode": "PT"
}
```

| Field | Required | Rules |
|---|---|---|
| `kind` | Yes | `mapbox`, `pin` or `custom` |
| `name` | Yes | Trimmed, not empty, at most 256 characters. For `custom` and `pin`, at most 100 characters counted as Unicode code points, the way Postgres counts them (matches `posts.custom_location_name`), so `❤️` counts as 2. |
| `mapboxId` | For `mapbox` | Mapbox's `mapbox_id`. Trimmed, not empty, at most 256 characters. Stored as `provider_place_id`. |
| `latitude` | For `mapbox` and `pin` | Number, -90 to 90. Stored to 6 decimal places. |
| `longitude` | For `mapbox` and `pin` | Number, -180 to 180. Stored to 6 decimal places. |
| `address`, `city`, `region` | No | Strings, trimmed. Blank becomes `null`. `address` at most 512 characters, `city` and `region` at most 256. |
| `countryCode` | No | Two letters, ISO 3166-1 alpha-2. Uppercased, so Mapbox's lowercase `pt` is accepted. |

Dropped pin: the typed name and the point under the pin.

```json
{ "kind": "pin", "name": "Hidden cove below Praia da Ursa", "latitude": 38.789811, "longitude": -9.499287 }
```

Custom location:

```json
{ "kind": "custom", "name": "Tia Rosa's kitchen" }
```

A custom request that includes any Mapbox field, a pin with any field besides `name`, `latitude` and `longitude`, or any request with an unknown field, is a `400`.

### Response: `200`

`200` whether the row was just created or already existed. A pin always creates a row and is still `200`.

```json
{
  "kind": "mapbox",
  "location": {
    "id": "uuid",
    "provider": "mapbox",
    "providerPlaceId": "dXJuOm1ieHBvaTo...",
    "name": "Pastéis de Belém",
    "address": "R. de Belém 84-92, 1300-085 Lisboa" | null,
    "latitude": 38.697464,
    "longitude": -9.203213,
    "city": "Lisbon" | null,
    "region": "Lisbon" | null,
    "countryCode": "PT" | null,
    "rating": { "average": 4.3, "count": 3 } | null
  }
}
```

`location` is the same `Location` shape the post endpoints return ([`itinerary-schema.md`](itinerary-schema.md)).

```json
{
  "kind": "pin",
  "location": {
    "id": "uuid",
    "provider": "custom",
    "providerPlaceId": "generated uuid",
    "name": "Hidden cove below Praia da Ursa",
    "address": null,
    "latitude": 38.789811,
    "longitude": -9.499287,
    "city": null,
    "region": null,
    "countryCode": null,
    "rating": null
  }
}
```

`created_by` isn't returned.

```json
{ "kind": "custom", "name": "Tia Rosa's kitchen" }
```

### Errors

| Status | When |
|---|---|
| `400` | Validation failed. `message` is a list of strings. |
| `401` | Not signed in |

### Behavior

- **Deduplication.** Rows are unique on `(provider, provider_place_id)`, so resolving the same Mapbox place twice returns the same row. Pins are never deduplicated.
- **First write wins.** If a Mapbox row already exists, it's returned unchanged. The fields in the request are only used to create the row.
- **Concurrency.** If two requests create the same Mapbox place at once, one hits the unique constraint and returns the row the other created.

## Starting point of the pin map (app)

`choosePinStart` in `apps/mobile/src/lib/pin-start.ts`:

1. With location permission, where the device is (`expo-location`).
2. Without it, the trip's `destination` text, geocoded with Mapbox (temporary geocoding: only used to move the map, never stored).
3. Then the place of the trip's latest post that has one.
4. Then the whole world. A story without a trip goes straight here.

The native screen is `components/location/drop-pin-sheet.tsx` with `pin-map.tsx` (react-native-maps). The web build has no map, so `pin-map.web.tsx` takes typed coordinates, starting from the same point.

## Seed data

`apps/api/prisma/seed.ts` seeds 8 real places (Lisbon, Sintra, Copenhagen) that match the seeded posts. Their `provider_place_id`s are placeholders like `seed.belem-tower`. They get real Mapbox IDs once the storage terms are settled. It also seeds one pin Maya dropped, "Hidden cove below Praia da Ursa", on one of her Lisbon trip posts, rated 5.

## Follow-ups

- **Storage terms decision** (DOC-1). Its outcome could change this table and the endpoint.
- **Client-supplied data isn't verified.** The server trusts the name and coordinates the app sends, so a client could tag made-up coordinates, or make up a `mapboxId` and create a row for a place that doesn't exist. Because of first write wins, the first request for a place sets its data for everyone, and Mapbox rows are never deleted. The fix is to look the place up on the server with Search Box `/retrieve/{mapboxId}` and ignore the client's fields. That needs a server-side Mapbox token and is billed as a separate Search Box session per new place, and it depends on the storage terms decision, so it's a separate ticket.
- **Real Mapbox IDs for the seed rows.**
- **Pins aren't checked either.** A pin's name and point are whatever the user sent. That only affects their own post or story, since nobody else can attach it.
