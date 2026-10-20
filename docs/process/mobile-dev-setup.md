# Mobile dev setup

How to get the Expo app (`apps/mobile`) running locally. Part of APP-1 (#30).

## Install

Use Node 24 (`nvm install && nvm use` from the repo root).

Install each app on its own, from inside its folder. Don't run `npm install`
from the repo root: the root `package.json` declares npm workspaces, and a root
install puts Expo's CLI and `expo-router` in different `node_modules` folders,
so `npm start` fails with `Cannot find module 'expo-router/_ctx-shared'`.

```bash
cd apps/mobile
npm install --workspaces=false
cp .env.example .env
```

Metro also expects a `node_modules` folder at the repo root. If `npm start`
fails with `ENOENT ... fall-26-sw-team-2/node_modules`, create an empty one
(it's gitignored):

```bash
mkdir -p node_modules   # from the repo root
```

## Environment

`apps/mobile/.env` (from `.env.example`):

| Variable | What it's for |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the API, without `/api`. On a physical phone use your computer's LAN IP (e.g. `http://192.168.1.20:3000`), not `localhost`. |
| `EXPO_PUBLIC_API_MOCKS` | `auto` (default), `all` or `none`. See [mobile-data-layer.md](mobile-data-layer.md#mocking-endpoints). |

`EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in them.
After changing `.env`, restart `npm start`.

## Run

```bash
cd apps/mobile
npm start
```

Then press `i` for the iOS Simulator (needs Xcode), `w` for the browser, or
scan the QR code with Expo Go on a phone on the same Wi-Fi. The `exp://` link
only opens on a phone; clicking it on a Mac shows a "no application" dialog.

Most screens use mock data, so the API doesn't have to be running. The API
allows cross-origin requests outside production, so the browser build (`w`) can
call your local API too. To run it
too, see the root [README](../../README.md#local-database); install it with
`npm install --workspaces=false` as above.

## Checks

Same as CI:

```bash
cd apps/mobile
npm run lint
npm run typecheck
npm run test:ui
```

## Development build

Mapbox and other native modules don't run in Expo Go, so the team is moving to
an EAS development build. That setup (`eas.json`, `expo-dev-client`, device
registration) is tracked in APP-2 (#76), and the steps will be added here when
it lands. Until then, use Expo Go.
