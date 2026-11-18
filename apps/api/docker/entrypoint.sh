#!/bin/sh
# Runs before every command in the API image (the server and the cleanup task).
# In ECS the database credentials arrive as separate DB_* variables from the RDS
# secret, so build DATABASE_URL from them unless it's already set.
set -e

if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
  DATABASE_URL="$(node -e '
    const env = process.env;
    const enc = encodeURIComponent;
    // RDS requires TLS. Node verifies the certificate (NODE_EXTRA_CA_CERTS has
    // the RDS bundle); Prisma migrate encrypts without verifying.
    const sslmode = env.DB_SSLMODE || "require";
    process.stdout.write(
      `postgresql://${enc(env.DB_USERNAME)}:${enc(env.DB_PASSWORD)}` +
        `@${env.DB_HOST}:${env.DB_PORT || "5432"}/${enc(env.DB_NAME || "yuji")}` +
        `?schema=public&sslmode=${sslmode}`,
    );
  ')"
  export DATABASE_URL
fi

exec "$@"
