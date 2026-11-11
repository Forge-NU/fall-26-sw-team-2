// Settings shared by the Yuji stacks. Values that differ per AWS account live in
// cdk.json context (yuji:*), not here.

// Keep in sync with the Postgres image in apps/api/docker-compose.yml and the
// e2e job in .github/workflows/lint-and-test.yml.
export const POSTGRES_FULL_VERSION = '18.6';
export const POSTGRES_MAJOR_VERSION = '18';

export const DATABASE_NAME = 'yuji';
export const DATABASE_USER = 'yuji';

export const API_CONTAINER_PORT = 3000;
export const HEALTH_CHECK_PATH = '/api/health';

// Origins allowed to call the staging API from a browser: the EAS Hosting web
// previews (https://yuji--pr-12.expo.app) and production web (https://yuji.expo.app).
// Check the subdomain against `eas deploy` output if web previews hit CORS errors.
export const DEFAULT_CORS_ORIGIN_PATTERN = '^https://yuji(--[a-z0-9-]+)?\\.expo\\.app$';

export const SECRET_NAMES = {
  database: 'yuji/staging/database',
  clerk: 'yuji/staging/clerk',
} as const;

// Keys of the Clerk secret, as the API reads them from the environment.
export const CLERK_SECRET_KEYS = [
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_WEBHOOK_SIGNING_SECRET',
] as const;
