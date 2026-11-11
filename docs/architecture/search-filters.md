# Search filters (#96)

The Map tab supports people, places, trips and posts. Search currently uses
mock data and has been tested on a phone with Expo Go.

## Search and filters

All shows up to three results per type. See all opens that type's list, which
loads more results as you scroll.

Filters opens a bottom sheet with dates, minimum rating, distance and sort.
It uses the shared BottomSheet and DateField. The Filters button shows the
number of active filters. Selections stay set when switching tabs; options
that do not apply to a type are hidden and left out of its request. Reset
clears the filters, and leaving search clears the search state.

Distance uses either the phone's location or the map center. Near me asks for
permission when selected. If permission is denied, it is disabled with an
explanation, and the map-center option still works. If getting the location
fails, search falls back to the map center.

Changing the query or filters cancels pending requests and drops late
responses. Paged results are deduplicated. The screen has loading skeletons,
an empty state with Clear filters, and Retry for failed searches or pages.

## Results

Trips use TripCard, posts use PostCard, and people use UserRow. Follow buttons
use the same follow logic as profiles. Opening a profile from search and
pressing Back returns to Maps.

Some result actions are temporary:

- Ratings are shown as text until the shared StarRating is available.
- Mock trips and posts open a card preview. Real trips open their trip page;
  real posts open a preview with View trip until post detail (#43) is ready.
- Selecting a place moves the map there. Existing map fixtures can open their
  place sheet; real place details come from #47.

## Still to do

- **#48 / PR #121:** combine the SRCH-2 search work with this branch and resolve
  the overlapping hook, API wrapper, search UI and tests.
- **#92:** replace rating text with StarRating.
- **#93 / PR #113:** switch to live search after it merges and test filters,
  paging and follow state with real data.

## Testing

UI tests, lint, typecheck, the shared-types build and iOS bundling passed.
Mock search was also tested manually on a phone using Expo Go. Live API testing
will follow #113.

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
