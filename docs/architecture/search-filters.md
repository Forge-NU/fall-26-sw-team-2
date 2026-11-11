# Search filters (#96)

The Map tab supports people, places, trips and posts, through `GET /api/search`
(SRCH-3, #113). It builds on the SRCH-2 people and places search (#48, PR #121).

## Search and filters

All shows up to three results per type. See all opens that type's list, which
loads more results as you scroll.

Filters opens a bottom sheet with dates, minimum rating, distance and sort.
It uses the shared BottomSheet and DateField. The Filters button shows the
number of active filters. Selections stay set when switching tabs; options
that do not apply to a type are hidden and left out of its request. Reset
clears the filters. Closing search (clearing the text or dismissing the sheet)
resets the tab and filters; opening a result and coming back, or tapping a map
pin mid-search, keeps them.

Distance uses either the phone's location or the map center. Near me asks for
permission when selected. If permission is denied, it is disabled with an
explanation, and the map-center option still works. If getting the location
fails, search falls back to the map center.

Requests wait for typing to pause (300 ms). The data comes through React
Query (`hooks/use-search.ts`): each search is cached by its text, tab and
filters, a changed query aborts the request in flight, and a late response for
an old query is never shown. While the same search is refined (typing or
deleting at the end, same tab and filters), the last results stay on screen
until the new ones arrive; anything else shows the loading state. Paged
results are deduplicated. The screen has loading skeletons, an empty state with
Clear filters, and Retry for failed searches or pages.

## Results

Trips use TripCard, posts use PostCard, and people use UserRow. Follow buttons
use the same follow logic as profiles (`useFollow`), which also updates the
cached search pages and the All preview. Opening a profile from search and
pressing Back returns to Maps with the search as it was.

Some result actions are temporary:

- Ratings are shown as text until the shared StarRating is available.
- Mock trips and posts open a card preview. Real trips open their trip page;
  real posts open a preview with View trip until post detail (#43) is ready.
- Selecting a place moves the map there. Existing map fixtures can open their
  place sheet; real place details come from #47.

## Still to do

- **#92:** replace rating text with StarRating.

## Testing

UI tests, lint, typecheck and the shared-types build cover the filters, the
mock and the request the app sends.

To try the mock flow, run from `apps/mobile`:

```sh
EXPO_PUBLIC_API_MOCKS=all npm run start
```

`EXPO_PUBLIC_API_MOCKS=none` uses the real API. To run checks:

```sh
npm run test:ui
npm run lint
npm run typecheck
```
