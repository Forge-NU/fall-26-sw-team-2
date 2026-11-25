# The API image, used by the ECS service and the hourly stories cleanup task.
# Build it from the repo root, since the API depends on the shared-types workspace:
#   docker build -f apps/api/Dockerfile .
# See docs/process/deployment.md.

FROM node:24-bookworm-slim AS build
WORKDIR /app

# npm ci checks every workspace in the lockfile, so copy all their package.json files.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/shared-types/package.json apps/shared-types/
COPY apps/mobile/package.json apps/mobile/
COPY infra/package.json infra/
RUN npm ci -w api -w shared-types

COPY apps/shared-types apps/shared-types
COPY apps/api apps/api
RUN npm run build -w shared-types \
  && cd apps/api \
  && npx prisma generate \
  && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# openssl for Prisma's migration engine. The RDS certificate bundle lets Node
# verify the database's TLS certificate.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/rds-global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/rds-global-bundle.pem

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/shared-types/package.json apps/shared-types/
COPY apps/mobile/package.json apps/mobile/
COPY infra/package.json infra/
RUN npm ci -w api -w shared-types --omit=dev && npm cache clean --force

COPY --from=build /app/apps/shared-types/dist apps/shared-types/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
COPY --chmod=755 apps/api/docker/entrypoint.sh apps/api/docker/start.sh apps/api/docker/

WORKDIR /app/apps/api
USER node
EXPOSE 3000
ENTRYPOINT ["/app/apps/api/docker/entrypoint.sh"]
# The server. The cleanup task overrides this with node dist/src/stories/cleanup.main.js.
CMD ["/app/apps/api/docker/start.sh"]
