import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

// Runs the *.constraints.sql files against the migrated test database. Each
// file is one transaction that raises on a failed check and rolls back its
// fixtures, so nothing is left behind either way.
const FILES = ['follows.constraints.sql', 'collaboration.constraints.sql'];

describe('Database constraints (e2e)', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it.each(FILES)('%s passes', async (file) => {
    const sql = readFileSync(join(__dirname, file), 'utf8');
    try {
      await client.query(sql);
    } catch (error) {
      // A failed check leaves the transaction open; close it for the next file
      await client.query('ROLLBACK');
      throw error;
    }
  });
});
