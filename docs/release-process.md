# Releases and PR previews

Every PR merged into `main` is a release, starting at **v0.0.1**. Every PR that
changes the app gets a preview reviewers can open on their phone before it merges:
in **Expo Go** (free, on by default), and optionally on **TestFlight** once the team
has a paid Apple Developer account.

## Versions

Versions live in git tags (`v0.0.1`, `v0.0.2`, …). Nothing is committed to bump them.

- Every PR needs exactly one release label. The **Release label** check fails until it
  has one:
  - `release:patch` for most changes (v0.0.1 → v0.0.2)
  - `release:minor` for a minor bump (v0.0.7 → v0.1.0)
  - `release:major` for a major one (v0.4.2 → v1.0.0)

  Add it from the PR's sidebar (**Labels**) or with
  `gh pr edit <number> --add-label release:patch`.
- While a PR is open, the **Release** section of its description shows the version it
  will release. It's worked out again at merge time, in case other PRs merge first.
- On merge, the `Release` workflow tags the merge commit and publishes a GitHub release
  with generated notes, then comments the release link on the PR.

The workflows are `.github/workflows/pr-version.yml` and `release.yml`. The version
logic is `.github/scripts/next-version.mjs`, which has tests next to it.

## Expo Go previews

`.github/workflows/expo-go-preview.yml` runs on every PR that changes `apps/mobile/`,
drafts included. It publishes the PR's JavaScript as an EAS Update on its own branch
(`pr-<number>`) and puts an **Expo Go preview** section in the PR description with a
QR code. To try a PR, install [Expo Go](https://expo.dev/go) and scan the code with
your phone's camera. Each PR has its own code, and a new push replaces it within a
couple of minutes.

- **Cost:** free. Publishing doesn't use any builds, and EAS Update's free plan covers
  a team our size.
- **Limits:** Expo Go only runs apps whose native modules ship inside it. All of ours do
  today. If a PR adds a library with its own native code, that PR's preview won't
  open in Expo Go; check a new library against Expo Go first
  (`node_modules/expo/bundledNativeModules.json` lists what's included).
- **Until `EXPO_TOKEN` is set**, the workflow skips itself with a notice instead of
  failing.

## TestFlight builds (optional, needs a paid Apple account)

`.github/workflows/ios-preview.yml` builds a real iOS app for TestFlight. It's off
until the repository variable `IOS_PREVIEWS` is set to `true`, because TestFlight
needs the Apple Developer Program ($99/year) even without publishing to the App Store.

Once on, it runs when a PR that isn't a draft changes `apps/mobile/`. A newer push
cancels the build in progress.

1. It stamps the version this PR would release into `app.json` (only for the build).
2. `eas build --local --profile pr-preview` builds the app on GitHub's macOS runner
   (Xcode 26.6), using the signing credentials stored on EAS. The build number goes
   up on its own each time.
3. `eas submit` uploads the build to App Store Connect and tags it with the PR in
   TestFlight's "What to Test" note.
4. The **iOS preview** section of the PR description shows "building", then the
   version and build number (or a link to the logs if it failed).

**Installing a PR's build.** TestFlight links point to a tester group, not to one
build, so there isn't a separate link per PR. Testers in the **PR Previews** internal
group open the TestFlight app, choose Yuji, and pick the build number from the PR
description. Builds usually show up within 30 minutes of the upload, once Apple
finishes processing them. Internal testing needs no Apple review.

**Cost.** Builds run on GitHub's macOS runners, which are free for public repos, so
they don't use the EAS plan's cloud builds. If the repo ever goes private, macOS
runner minutes are billed (at 10 times the Linux rate). Each build takes 20 to 40
minutes of runner time.

**Xcode.** Expo SDK 57 needs Xcode 26.4 or newer. The workflow pins Xcode 26.6 on the
`macos-26` runner; update both when a new Expo SDK needs a newer Xcode (the runner
images list what's installed: github.com/actions/runner-images).

## One-time setup

### For Expo Go previews (free)

**Expo**
1. Create an Expo account or organization for the team.
2. In `apps/mobile`, run `npx eas-cli@latest login`, then `npx eas-cli@latest init`.
   This links the project and writes its ID into `app.json`.
3. Run `npx eas-cli@latest update:configure`. It installs `expo-updates` and adds
   `runtimeVersion` and `updates.url` to `app.json`. Commit both changes.
4. Set `EXPO_PUBLIC_API_URL` for the `preview` environment on expo.dev (Project →
   Environment variables) to a deployed API. Until staging exists (#34), previews
   can't reach an API and the feed shows its error state.

**GitHub** (repo Settings)
1. Add a secret `EXPO_TOKEN`: an access token from expo.dev → Account settings →
   Access tokens (a robot token for the organization is best).
2. Make the **Release label** check required: in Settings → Rules (or Branches), add a
   rule for `main` that requires the "Release label" status check, so a PR can't
   merge without one. This needs admin access. The labels themselves already exist.

### For TestFlight builds (later)

**Apple**
1. Join the Apple Developer Program for the team.
2. In App Store Connect, create the app with bundle ID `com.forgenu.yuji` (or change
   `ios.bundleIdentifier` in `apps/mobile/app.json` to the one you register).
3. Copy the app's Apple ID (a number, under App Information) into both `ascAppId`
   values in `apps/mobile/eas.json`.
4. Under TestFlight → Internal Testing, create a group named **PR Previews** and turn
   on automatic distribution. Add teammates to App Store Connect (Users and Access)
   and to the group.

**Expo**
1. Run `npx eas-cli@latest credentials -p ios` and set up the distribution certificate,
   the provisioning profile, and an App Store Connect API key (EAS uses the key to
   upload builds).
2. Optional: check the credentials and upload before CI does, by running
   `npx eas-cli@latest build -p ios --profile pr-preview --local --output yuji.ipa`
   on a Mac with Xcode 26.4+, then
   `npx eas-cli@latest submit -p ios --profile pr-preview --path yuji.ipa`.

**GitHub**
1. Add a repository variable `IOS_PREVIEWS` set to `true`.
2. Optional: add a repository variable `TESTFLIGHT_URL` with a link to the app in
   TestFlight. The PR description shows it as "Open TestFlight".
