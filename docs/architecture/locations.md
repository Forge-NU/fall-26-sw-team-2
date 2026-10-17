# Locations: Mapbox Places and the Resolve Endpoint

Status: Built
Issue: #37 (LOC-1)

## Overview

One shared definition of a location, used by posts, stories, the map and search. The `locations` table itself is defined in [`itinerary-schema.md`](itinerary-schema.md#locations). This doc covers the endpoint that turns a place the user picked into something a post can reference.

Product rules are in DOC-1 ([`mvp-decisions.md`](../product/mvp-decisions.md#locations)), including the Mapbox storage terms. If this doc disagrees with DOC-1, DOC-1 wins.

Code: `apps/api/src/locations/`. Request and response types are in `apps/api/src/locations/location.types.ts`, and move to `shared-types` once API-1 (#28) adds it.

## How a location gets onto a post

1. The app searches Mapbox directly, and the user taps a result or types a custom name.
2. The app sends it to `POST /api/locations/resolve`.
3. The app creates the post (`POST /api/posts`) with either:
   - `locationId`: the `location.id` from a `mapbox` result, or
   - `customLocationName`: the `name` from a `custom` result.

A Mapbox place becomes a shared `locations` row, and two posts at the same place share it. A custom name is never stored in `locations`. It goes on the post as `custom_location_name` (DOC-1: custom locations have no coordinates and don't show on the map).

## `POST /api/locations/resolve`

Auth: signed in (`ClerkAuthGuard`). Otherwise `401`.

Finds the `locations` row for a Mapbox place, creating it if needed. For a custom name, it validates the name and returns it without writing anything.

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
| `kind` | Yes | `mapbox` or `custom` |
| `name` | Yes | Trimmed, not empty, at most 256 characters. For `custom`, at most 100 characters counted as Unicode code points, the way Postgres counts them (matches `posts.custom_location_name`), so `❤️` counts as 2. |
| `mapboxId` | For `mapbox` | Mapbox's `mapbox_id`. Trimmed, not empty, at most 256 characters. Stored as `provider_place_id`. |
| `latitude` | For `mapbox` | Number, -90 to 90 |
| `longitude` | For `mapbox` | Number, -180 to 180 |
| `address`, `city`, `region` | No | Strings, trimmed. Blank becomes `null`. `address` at most 512 characters, `city` and `region` at most 256. |
| `countryCode` | No | Two letters, ISO 3166-1 alpha-2. Uppercased, so Mapbox's lowercase `pt` is accepted. |

Custom location:

```json
{ "kind": "custom", "name": "Tia Rosa's kitchen" }
```

A custom request that includes any Mapbox field, or any request with an unknown field, is a `400`.

### Response: `200`

`200` whether the row was just created or already existed.

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
    "countryCode": "PT" | null
  }
}
```

`location` is the same `Location` shape the post endpoints return ([`itinerary-schema.md`](itinerary-schema.md)).

```json
{ "kind": "custom", "name": "Tia Rosa's kitchen" }
```

### Errors

| Status | When |
|---|---|
| `400` | Validation failed. `message` is a list of strings. |
| `401` | Not signed in |

### Behavior

- **Deduplication.** Rows are unique on `(provider, provider_place_id)`, so resolving the same place twice returns the same row.
- **First write wins.** If the row already exists, it's returned unchanged. The fields in the request are only used to create the row.
- **Concurrency.** If two requests create the same place at once, one hits the unique constraint and returns the row the other created.

## Seed data

`apps/api/prisma/seed.ts` seeds 8 real places (Lisbon, Sintra, Copenhagen) that match the seeded posts. Their `provider_place_id`s are placeholders like `seed.belem-tower`. They get real Mapbox IDs once the storage terms are settled.

## Follow-ups

- **Storage terms decision** (DOC-1). Its outcome could change this table and the endpoint.
- **Client-supplied data isn't verified.** The server trusts the name and coordinates the app sends, so a client could tag made-up coordinates, or make up a `mapboxId` and create a row for a place that doesn't exist. Because of first write wins, the first request for a place sets its data for everyone, and rows are never deleted. The fix is to look the place up on the server with Search Box `/retrieve/{mapboxId}` and ignore the client's fields. That needs a server-side Mapbox token and is billed as a separate Search Box session per new place, and it depends on the storage terms decision, so it's a separate ticket.
- **Real Mapbox IDs for the seed rows.**
