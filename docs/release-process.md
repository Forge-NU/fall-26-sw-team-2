# Releases and PR builds

Every PR merged into `main` is a release, starting at **v0.0.1**. Every PR that
changes the app also gets an iOS build on TestFlight, so reviewers can try it before
it merges.

## Versions

Versions live in git tags (`v0.0.1`, `v0.0.2`, …). Nothing is committed to bump them.

- Each merged PR bumps the **patch** version: v0.0.1, v0.0.2, …
- Add a `release:minor` label for a minor bump (v0.0.7 → v0.1.0), or `release:major`
  for a major one (v0.4.2 → v1.0.0).
- While a PR is open, the **Release** section of its description shows the version it
  will release. It's worked out again at merge time, in case other PRs merge first.
- On merge, the `Release` workflow tags the merge commit and publishes a GitHub release
  with generated notes, then comments the release link on the PR.

The workflows are `.github/workflows/pr-version.yml` and `release.yml`. The version
logic is `.github/scripts/next-version.mjs`, which has tests next to it.

## iOS builds on TestFlight

`.github/workflows/ios-preview.yml` runs when a PR that isn't a draft changes
`apps/mobile/`. Draft PRs don't build; marking one ready for review starts a build. A
newer push to the PR cancels the build in progress.

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
description. Each build's "What to Test" note says which PR it came from. Builds
usually show up within 30 minutes of the upload, once Apple finishes processing
them. Internal testing needs no Apple review.

**Cost.** Builds run on GitHub's macOS runners, which are free for public repos, so
they don't use the EAS plan's cloud builds. If the repo ever goes private, macOS
runner minutes are billed (at 10 times the Linux rate), and EAS cloud builds may be
cheaper again. Each build takes 20 to 40 minutes of runner time.

**Xcode.** Expo SDK 57 needs Xcode 26.4 or newer. The workflow pins Xcode 26.6 on the
`macos-26` runner; update both when a new Expo SDK needs a newer Xcode (the runner
images list what's installed: github.com/actions/runner-images).

## One-time setup

The workflows fail until these are done. Someone with admin access to each account
has to do them.

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
1. Create an Expo account or organization for the team.
2. In `apps/mobile`, run `npx eas-cli@latest login`, then `npx eas-cli@latest init`.
   This links the project and writes its ID into `app.json`; commit that.
3. Run `npx eas-cli@latest credentials -p ios` and set up the distribution certificate,
   the provisioning profile, and an App Store Connect API key (EAS uses the key to
   upload builds).
4. Optional: check the credentials and upload before CI does, by running
   `npx eas-cli@latest build -p ios --profile pr-preview --local --output yuji.ipa`
   on a Mac with Xcode 26.4+, then
   `npx eas-cli@latest submit -p ios --profile pr-preview --path yuji.ipa`.
5. Set `EXPO_PUBLIC_API_URL` for the `preview` environment on expo.dev (Project →
   Environment variables) to a deployed API. Until staging exists (#34), TestFlight
   builds can't reach an API and the feed shows its error state.

**GitHub** (repo Settings)
1. Add a secret `EXPO_TOKEN`: an access token from expo.dev → Account settings →
   Access tokens (a robot token for the organization is best).
2. Create the labels `release:minor` and `release:major`.
3. Optional: add a repository variable `TESTFLIGHT_URL` with a link to the app in
   TestFlight. The PR description shows it as "Open TestFlight".
