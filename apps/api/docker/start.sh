#!/bin/sh
# The API server's command: apply pending migrations, then start. Prisma holds a
# lock while migrating, so tasks starting together don't run them twice. If a
# migration fails the task exits, and ECS rolls the deployment back.
set -e

npx --no-install prisma migrate deploy
exec node dist/src/main.js
