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

Navigation and existing themed text also use this theme. Currently, both color
mode keys use the light theme.

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

Run `npm start` in `apps/mobile` and open the **Components** tab. The preview
shows every UI-1 primitive and is development-only; release visits redirect home.
Run `npm run typecheck`, `npm run lint` and `npm run test:ui` for checks.

