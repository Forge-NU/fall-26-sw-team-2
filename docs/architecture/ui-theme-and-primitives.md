# UI-1: Theme and primitive components

Shared theme and primitives for mobile screens. Replaces the Expo starter theme
and keeps typography, colors and component styling consistent.

Design: [Main Design File](https://www.figma.com/design/hODpCTEtGSlFxzmenOK1ek/Main-Design-File?node-id=0-1)
and [component references](https://www.figma.com/design/EGgoOkj3nv93b47ddnAnyv/Trip-Creation-Management?node-id=0-1).

## Theme

Import `Theme`, `Palette`, `Typography`, `Spacing` and `Radii` from
`@/constants/theme`. Use these tokens instead of hard-coded colors or font sizes.
Fonts are Barlow Condensed for headings and Plus Jakarta Sans for other text.

```tsx
import { Theme, Spacing } from '@/constants/theme';

const screenStyle = {
  backgroundColor: Theme.colors.background,
  padding: Spacing.three,
};
```

Navigation also uses this theme. Currently, both color mode keys use the light
theme. `Theme.colors.scrim` is the dimmed backdrop behind sheets and dialogs.

Component-specific sizes live next to the theme in `src/constants/*-tokens.ts`.
A lint rule (UI-3) flags hex and `rgba()` colors and numbers for `fontSize`,
`gap`, `padding*`, `margin*` and `borderRadius` anywhere in `src/` outside
`src/constants/`. Hits from before the rule are counted per file in
`apps/mobile/eslint-suppressions.json`, so only new ones fail. After fixing some,
run `npm run lint:prune` to lower the counts.

Dates: `@/utils/local-date` has every date helper. Dates are `YYYY-MM-DD`
strings in the user's local time, shown as "Oct 3, 2026" (`formatDate`) or
"Oct 3 – 6, 2026" (`formatDateRange`).

## Screens

Every screen starts with `Screen` from `@/components/ui/screen`. It handles the
safe area, the warm background, 16px side gutters and a max width, and shows a
loading, error or empty state in place of the content.

```tsx
<Screen
  header={<ScreenHeader title="My trips" left={{ icon: 'arrow-left', label: 'Back', onPress: back }} />}
  scroll
  loading={trips.isPending}
  error={trips.error}
  onRetry={() => void trips.refetch()}
  empty={trips.data?.length === 0 && { title: 'No trips yet', action: { title: 'New trip', onPress: newTrip } }}>
  {trips.data?.map((trip) => <TripRow key={trip.id} trip={trip} />)}
</Screen>
```

| Prop | Usage |
| --- | --- |
| `header` | Stays above the content. Usually a `ScreenHeader`. |
| `scroll` | Wraps the content in a `ScrollView`. Leave it off when the screen has its own `FlatList`. |
| `edges` | Safe-area edges, default top and bottom. Tab screens use `['top']`. |
| `loading`, `loadingFallback` | Shows `loadingFallback`, or a few `Skeleton` rows. |
| `error`, `onRetry`, `errorState` | Any non-null `error` shows an `EmptyState` with `getErrorMessage(error)` and Try again. `errorState` overrides parts of it. |
| `empty` | `EmptyState` props, shown instead of the content when set. |

Loading wins over error, error wins over empty, and the children only show when
none of them apply. The checklist for new screens is
[docs/process/ui-checklist.md](../process/ui-checklist.md).

## Components

Import components from `@/components/ui/<file-name>`.

| Component | Main props / usage |
| --- | --- |
| `AppText` | `variant`: heading, supporting, subheading, body, button, label or caption; `color`: palette key. |
| `Button` | `title`, `onPress`, coral/teal `variant`, `disabled`, `loading`. Loading prevents repeated presses. |
| `Input` | Native text-input props plus `label`, `hint`, `error`, `disabled`. `containerStyle` styles the wrapper; `style` styles the input. |
| `Avatar` | `name`, `uri`, compact/small/medium/large `size`. Shows a default avatar when an image is missing or fails to load. |
| `EmptyState` | `title`, optional `description`, `icon` and button `action`. |
| `Skeleton` | `width`, `height`, `circle`, `animate`. Follows the device's Reduce Motion setting; use `animate={false}` for a static loading placeholder. |
| `ToastProvider` / `useToast` | Success, error and info notifications. Provider is mounted in `_layout.tsx`. |
| `ScreenHeader` | `title`, `left` (`{ icon, label, onPress }`) and `right` (usually `IconButton`s). The title stays centered. |
| `IconButton` | `icon` (an `Icon` name), `accessibilityLabel`, `onPress`; optional `count`, `selected`, `variant="surface"`. |
| `Pill` | `label`, `state`: default, selected or live; `showPin`, `onPress`. Day tabs, places and status badges. |
| `DateField` | `label`, `value` (`YYYY-MM-DD` or null), `onChange`, `error`. Opens a month calendar that works the same on iOS, Android and web. |
| `ConfirmDialog` | `visible`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `loading`. Use it instead of `Alert.alert`, which does nothing on web. |
| `Toggle` | `value`, `onValueChange`, `accessibilityLabel`. |

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

<Button title="Save" variant="teal" loading={saving} onPress={save} />
<Input label="Username" value={username} onChangeText={setUsername} error={error} />
```

React components call `useToast()` from `@/components/ui/toast-provider`.
API clients can call `showToast` from `@/lib/toast`:

```ts
import { showToast } from '@/lib/toast';

showToast({ message: 'Could not save. Please try again.', variant: 'error' });
```

Toasts dismiss after 4 seconds. Use `duration: 0` to keep one until tapped or
`hideToast()` is called. A new message replaces the old one. The API-client
function returns `false` if no provider is mounted; it does not queue messages.

## Preview and verification

Run `npm start` in `apps/mobile`, press `w` and visit `/components-preview`. The preview
shows every primitive above, including `Screen` in each of its states, and is
development-only; release visits redirect home.
Run `npm run typecheck`, `npm run lint` and `npm run test:ui` for checks.

