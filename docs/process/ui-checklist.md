# UI checklist

Go through this before opening a PR that adds or changes a mobile screen. It's
linked from the PR template. Background is in
[UI-1: Theme and primitives](../architecture/ui-theme-and-primitives.md) and
[UI-2: Content components](../architecture/content-components.md).

## Layout

- [ ] The screen uses `Screen` from `@/components/ui/screen`, with its header in
  the `header` prop (usually a `ScreenHeader`). No hand-rolled `SafeAreaView`,
  background color or side padding.
- [ ] Sheets use `BottomSheet`, and confirmations use `ConfirmDialog`
  (`Alert.alert` does nothing on web).

## Components

- [ ] Text is `AppText`, buttons are `Button` or `IconButton`, fields are
  `Input` or `DateField`, tags and day tabs are `Pill`.
- [ ] Trips, posts, people and counts use the UI-2 components (`TripCard`,
  `PostCard`, `MediaCarousel`, `UserRow`, `StatRow`) instead of a local copy.
- [ ] If you needed something that isn't there, add it to `components/ui/` or
  `components/content/` and to the components preview (`/components-preview`),
  instead of building it inside the screen.

## Tokens

- [ ] Colors come from `Palette` or `Theme.colors`, sizes from `Spacing` and
  `Radii`, and text styles from `AppText` variants or `Typography`.
- [ ] `npm run lint` passes, and `eslint-suppressions.json` didn't gain any
  entries. The lint rule flags hex and `rgba()` colors, and numbers for
  `fontSize`, `gap`, `padding*`, `margin*` and `borderRadius`, anywhere in
  `src/` outside `src/constants/`. If the design needs a value that isn't a
  token, add it to a token file in `src/constants/` rather than suppressing it.

## States

- [ ] Loading shows skeletons (`Screen`'s `loading` prop), not a blank screen
  or a spinner.
- [ ] Empty has an `EmptyState` with a next step when there is one (`empty`).
- [ ] Errors say what went wrong and offer Try again (`error` and `onRetry`).
- [ ] No control fakes success or does nothing. If the feature behind a button
  isn't built yet, hide the button.

## Design

- [ ] It matches the Figma frame. Link the frame in the PR, and call out
  anything you changed on purpose (for example where DOC-1 disagrees).
- [ ] Screenshots at iPhone size are in the PR.
