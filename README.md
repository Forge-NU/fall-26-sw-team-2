# Pinly 📍

Share your journey, log your experiences, and discover inspiration from around the globe.

## Team
- **Project Lead:** Christian Garcia
- **Members:** Aditya Vij, Angela You, Atul Phadke, Duke Diamond, Grace Kim, Lucy Shah, Richie Nguyen, Ruoxi Wang
- **Semester:** Fall 2026

## Why This Exists
Today, travel apps tend to serve one of two purposes: plan the details of a trip you've already decided on, or act as a diary to share with only your friends. Neither of these allow you to discover **where** to go, and **what** to do once you're there. Pinly is built for those who want real, rated itineraries and experiences from people outside their immediate connections, surfaced by their personal taste and community rather than who they already follow.

## Tech Stack
- Frontend: Expo (React Native)
- Backend: NestJS
- Database: AWS RDS, S3
- Infra/Deploy: Expo Application Services, GitHub Actions, AWS ECS Fargate

## Getting Started
**Prerequisite:** Node 24 (pinned in `.nvmrc`). With [nvm](https://github.com/nvm-sh/nvm), run `nvm install && nvm use` from the repo root.

Each app reads env vars from a `.env` file. Copy `apps/api/.env.example` and `apps/mobile/.env.example` to `.env` in the same folder and fill in values.

```
# clone
git clone https://github.com/Forge-NU/fall-26-sw-team-2.git
cd fall-26-sw-team-2
nvm use

# install (each app has its own dependencies)
cd apps/api && npm install && cp .env.example .env && cd ../..
cd apps/mobile && npm install && cp .env.example .env && cd ../..
```

Run the API and the mobile app in separate terminals:

```
# terminal 1: API on http://localhost:3000 (restarts on file changes)
cd apps/api
npm run start:dev

# terminal 2: Expo dev server
cd apps/mobile
npm start
```

In the Expo terminal, press `i` for the iOS simulator, `a` for the Android emulator, or `w` for web, or scan the QR code with Expo Go on your phone. On a physical phone, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your computer's LAN IP (e.g. `http://192.168.1.20:3000`) instead of `localhost`.

### Checks (same as CI)
```
# API
cd apps/api
npm run lint && npm test && npm run build

# Mobile
cd apps/mobile
npm run lint && npm run typecheck
```

## Repo Structure
```
/apps/api       - NestJS backend
/apps/mobile    - Expo (React Native) app
/shared         - shared code across apps
/docs           - design docs, architecture decisions
/.github        - CI workflows, issue templates, PR template
```

## Design Docs
Link to Figma / design review slides / architecture doc here.

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) for our git workflow and how to open a ticket.
