# Mobile dev setup

How to get the Expo app (`apps/mobile`) running locally. Part of APP-1 (#30).

## Install

Use Node 24 (`nvm install && nvm use` from the repo root).

Install from the repo root. The root `package.json` declares npm workspaces,
so one `npm install` installs every app against the single root
`package-lock.json`:

```bash
npm install                                   # from the repo root
cp apps/mobile/.env.example apps/mobile/.env
```

Add mobile dependencies with `npx expo install <package>` from `apps/mobile`,
which picks versions that match the Expo SDK. Don't use
`--workspaces=false`, which creates a second lockfile in `apps/mobile`.

## Environment

`apps/mobile/.env` (from `.env.example`):

| Variable | What it's for |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of the API, without `/api`. On a physical phone use your computer's LAN IP (e.g. `http://192.168.1.20:3000`), not `localhost`. |
| `EXPO_PUBLIC_API_MOCKS` | `auto` (default), `all` or `none`. `all` also skips sign-in, so the trip, post and story screens run without a Clerk key or the API. See [mobile-data-layer.md](mobile-data-layer.md#mocking-endpoints). |

`EXPO_PUBLIC_*` values are bundled into the app, so never put secrets in them.
After changing `.env`, restart `npm start`.

## Run

```bash
cd apps/mobile
npm start
```

`npm start` opens the app in Expo Go. To use a development build instead, see
[Development build](#development-build).

Then press `i` for the iOS Simulator (needs Xcode), `w` for the browser, or
scan the QR code with Expo Go on a phone on the same Wi-Fi. The `exp://` link
only opens on a phone; clicking it on a Mac shows a "no application" dialog.

Most screens use mock data, so the API doesn't have to be running. The API
allows cross-origin requests outside production, so the browser build (`w`) can
call your local API too. To run it
too, see the root [README](../../README.md#local-database). The root
`npm install` above already installed it.

## Checks

Same as CI:

```bash
cd apps/mobile
npm run lint
npm run typecheck
npm run test:ui
```

## Development build

A development build is our own copy of the app with Expo's developer tools
built in (`expo-dev-client`). It loads JavaScript from your `npm start` server
the same way Expo Go does. The difference is that it can include native modules
Expo Go doesn't ship. Today the app only uses modules Expo Go includes, so Expo
Go still works for everything. Once the app adds a native module that Expo Go
doesn't include, you'll need the development build.

Run every `eas` command from `apps/mobile` as `npx eas-cli@latest`. Running it
from the repo root offers to create a new Expo project. Sign in once with
`npx eas-cli@latest login`, using an account in the `forgeyuji` Expo
organization.

### Build profiles

`apps/mobile/eas.json`:

| Profile | What it builds | EAS environment |
|---|---|---|
| `development` | Development build for registered iPhones | `development` |
| `development-simulator` | Development build for the iOS Simulator. No Apple account needed. | `development` |
| `staging` | App without developer tools that calls the staging API, for registered iPhones | `preview` |
| `pr-preview`, `production` | Store builds, see [release-process.md](../release-process.md) | `preview`, `production` |

The development build reads `EXPO_PUBLIC_*` values from your local `.env`,
because its JavaScript comes from your `npm start` server. The staging build
bundles its JavaScript at build time, so it uses the EAS `preview` environment.
That environment already has the staging `EXPO_PUBLIC_API_URL` and the Clerk
key, and the Expo Go PR previews use it too. A separate `staging` environment
would need a paid Expo plan.

### On the iOS Simulator

No Apple Developer account needed. Build it in the cloud:

```bash
cd apps/mobile
npx eas-cli@latest build --profile development-simulator --platform ios
```

When the build finishes, press `Y` to install it on the simulator. To install
the latest build again later, run
`npx eas-cli@latest build:run --platform ios --latest`.

With Xcode installed, you can also build it on your Mac instead with
`npx expo run:ios`.

### On your iPhone

Installing on a phone needs a paid Apple Developer account linked to the
`forgeyuji` Expo organization, because EAS signs the build with an ad hoc
profile that lists each phone. While the team doesn't have one, see
[Without a paid Apple account](#without-a-paid-apple-account).

1. Register your phone (once per phone):

   ```bash
   cd apps/mobile
   npx eas-cli@latest device:create
   ```

   Open the link it gives you on the iPhone and install the profile.

2. Someone with access to the Apple account builds for every registered phone:

   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```

   A phone registered after a build can't install that build. Run the build
   again to include it.

3. Open the build link from the output or expo.dev on your phone and install it.
4. On iOS 16 and later, turn on Developer Mode: Settings > Privacy & Security >
   Developer Mode, then restart the phone.

### Without a paid Apple account

Connect your iPhone to your Mac by cable and build the app on your Mac with a
free Apple ID. This needs Xcode:

```bash
cd apps/mobile
npx expo run:ios --device
```

Apple only signs these builds for 7 days. After that the app stops opening and
you have to run the command again.

Free Apple IDs can't sign apps that use Sign in with Apple. The app doesn't
offer it, so `app.json` sets `"appleSignIn": false` on the `@clerk/expo` plugin.
If we add Sign in with Apple later, remove that setting. Free Apple ID builds
will then stop working, and local simulator builds will need a signing
certificate.

### Run the development build

```bash
cd apps/mobile
npm run start:dev-client
```

Open the Yuji development build on your phone or simulator. It lists dev
servers on the same Wi-Fi, or you can scan the QR code with the camera. Press
`s` in the terminal to switch between Expo Go and the development build.

You only need a new build when native code changes: a new package with native
code, a new config plugin, or native settings in `app.json`. JavaScript
changes load from `npm start` like they do in Expo Go.

### Staging build

A build without developer tools that calls the staging API (INF-1 #34), for
checking the app the way testers will use it. It installs on registered
iPhones like the development build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile staging --platform ios
```
