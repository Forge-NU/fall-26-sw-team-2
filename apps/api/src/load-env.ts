import { existsSync } from 'fs';

// Loads apps/api/.env for local development. Imported first in main.ts because
// some modules (e.g. the Clerk client) read process.env at import time.
// Deployed environments set real environment variables and have no .env file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
