# Releases and PR previews

Every PR merged into `main` is a release, starting at **v0.0.1**. Every PR that
changes the app gets a preview reviewers can open on their phone in **Expo Go**
before it merges.

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

## App previews

`.github/workflows/app-preview.yml` runs on every PR that changes `apps/mobile/`,
drafts included, and adds two sections to the PR description:

- **Expo Go preview:** the PR's JavaScript is published as an EAS Update on its own
  branch (`pr-<number>`), with a QR code. Install [Expo Go](https://expo.dev/go) and
  scan the code with your phone's camera. A new push replaces it within a couple of
  minutes.
- **Web preview:** the web build is deployed to EAS Hosting under the alias
  `pr-<number>`, with a link that stays the same as the PR is updated. It's a quick
  way to look without a phone, but the web version can differ from the phone app.

- **Cost:** free. Neither preview uses any builds. EAS Update and EAS Hosting are
  included in Expo's free plan, with usage limits that paid plans raise.
- **Limits:** Expo Go only runs apps whose native modules ship inside it. All of ours do
  today. If a PR adds a library with its own native code, that PR's preview won't
  open in Expo Go; check a new library against Expo Go first
  (`node_modules/expo/bundledNativeModules.json` lists what's included).
- **Until `EXPO_TOKEN` is set**, the workflow skips itself with a notice instead of
  failing.

TestFlight builds are planned for later. They need the Apple Developer Program
($99/year), even without publishing to the App Store.

## One-time setup

**Expo** (done)
1. Create an Expo account or organization for the team.
2. In `apps/mobile`, run `npx eas-cli@latest init`, then
   `npx eas-cli@latest update:configure`, and commit the changes to `app.json`,
   `eas.json` and `package.json`.
3. Set `EXPO_PUBLIC_API_URL` for the `preview` environment on expo.dev (Project →
   Environment variables) to a deployed API. Until staging exists (#34), previews
   can't reach an API and the feed shows its error state.

**GitHub** (repo Settings)
1. Add a secret `EXPO_TOKEN`: an access token from expo.dev → Account settings →
   Access tokens. (Done.)
2. Make the **Release label** check required: in Settings → Rules (or Branches), add a
   rule for `main` that requires the "Release label" status check, so a PR can't
   merge without one. This needs admin access. The labels themselves already exist.
