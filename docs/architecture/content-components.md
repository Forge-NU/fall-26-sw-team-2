# UI-2: Content components

Shared cards, photo carousel and user/stat rows for mobile screens. Components
use the UI-1 theme and primitives, with data types from `shared-types`.

Design: [Feed](https://www.figma.com/design/1x6D2dFUyxDqH5Ph9xSDFH/Feed?node-id=28-288)
and [Profile](https://www.figma.com/design/MCgpCJnIb9ybk2ka5lxDu5/Follower-List?node-id=5-3).

## Components

Import components from `@/components/content/<file-name>`.

| Component | Main props / usage |
| --- | --- |
| `TripCard` | `trip`, optional `posts` or `dayPreviews`; featured day with scrollable day thumbnails. Supports draft/published status and navigation, share and add-place callbacks. |
| `PostCard` | `post`, optional `stats`, `onPress`, `onUserPress` and `onShare`. Shows photos, location, caption and date. |
| `MediaCarousel` | `items`: image media. Supports swiping, arrows, page count and empty/failed-image fallbacks. Single photos hide paging controls. |
| `UserRow` | `user`, optional `subtitle`, `verified`, `onPress` and button `action`. |
| `StatRow` | `items`: counts with labels, optional icons, selection state and callbacks. |

```tsx
import { TripCard } from '@/components/content/trip-card';
import { PostCard } from '@/components/content/post-card';

<TripCard trip={trip} posts={posts} onPress={openTrip} />
<PostCard post={post} stats={stats} onPress={openPost} onShare={sharePost} />
```

Screens supply data, navigation and action callbacks, including like/follow state.

Import `IconButton` from `@/components/ui/icon-button` for icon actions.
Use `icon`, `accessibilityLabel` and `onPress`, with optional `count`,
`selected`, `selectedIcon`, `disabled` and `variant="surface"`.

## Preview and verification

Run `npm start` in `apps/mobile` and press `w` to open the web app, then visit
`/components-preview`.
The development-only preview includes every UI-2 component, a five-day trip and
1-photo/30-photo carousel examples. Photos are bundled locally; credits are in
`apps/mobile/assets/preview/README.md`.

Run `npm run typecheck` and `npm run lint`. On a device, check carousel swiping,
rotation, large text and component actions against the design references.
