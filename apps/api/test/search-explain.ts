// Run with SEARCH_TEST_DATABASE_URL=... node -r ts-node/register test/search-explain.ts.
// Extra representative fixtures are rolled back; no production database URL fallback.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { buildSearchSql } from '../src/search/search-query';
import type { SearchType } from 'shared-types';

async function main() {
  const url = process.env.SEARCH_TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      'Set SEARCH_TEST_DATABASE_URL to a migrated, seeded test database',
    );
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261103120000_advanced_search/migration.sql',
        ),
        'utf8',
      ),
    );
    await client.query(`INSERT INTO "User" (id, email, username, first_name, last_name, updated_at)
      SELECT 'search_fixture_' || n, 'fixture' || n || '@example.com', 'fixture_' || n, 'Fixture', n::text, now() FROM generate_series(1, 10000) n ON CONFLICT DO NOTHING`);
    await client.query(`INSERT INTO locations (id, provider, provider_place_id, name, city, region, latitude, longitude, updated_at)
      SELECT ('10000000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid, 'mapbox', 'search_fixture_' || n, 'Fixture ' || n, 'Fixture City', 'Fixture Region', 55, 12, now() FROM generate_series(1, 10000) n ON CONFLICT DO NOTHING`);
    await client.query(`INSERT INTO trips (id, owner_id, title, destination, description, start_date, end_date, status, published_at, updated_at)
      SELECT ('10000000-0000-4000-b000-' || lpad(n::text,12,'0'))::uuid, 'user_seed_maya', 'Fixture ' || n, 'Fixture City', 'Fixture description', '2020-01-01', '2020-01-02', 'published', now(), now() FROM generate_series(1, 10000) n ON CONFLICT DO NOTHING`);
    await client.query(`INSERT INTO posts (id, trip_id, location_id, caption, visited_on, updated_at)
      SELECT ('10000000-0000-4000-c000-' || lpad(n::text,12,'0'))::uuid, ('10000000-0000-4000-b000-' || lpad(n::text,12,'0'))::uuid, ('10000000-0000-4000-a000-' || lpad(n::text,12,'0'))::uuid, 'Fixture caption ' || n, '2020-01-01', now() FROM generate_series(1, 10000) n ON CONFLICT DO NOTHING`);
    for (const table of ['"User"', 'trips', 'posts', 'locations'])
      await client.query(`ANALYZE ${table}`);
    // Bulk inserts leave a GIN pending list. Flush it as autovacuum normally
    // would, so plans measure the populated indexes rather than bulk-load state.
    await client.query(`SELECT gin_clean_pending_list(c.oid::regclass)
      FROM pg_class c JOIN pg_am a ON a.oid = c.relam
      WHERE a.amname = 'gin' AND c.relnamespace = current_schema()::regnamespace
`);
    const cases: {
      type: SearchType;
      q: string;
      from?: string;
      to?: string;
      lat?: number;
      lng?: number;
      radiusKm?: number;
    }[] = [
      { type: 'people', q: 'Maya' },
      { type: 'places', q: 'Belém' },
      { type: 'places', q: 'Li', lat: 38.7, lng: -9.2, radiusKm: 10 },
      { type: 'trips', q: 'Lisbon' },
      { type: 'trips', q: 'Li', from: '2026-09-01', to: '2026-09-30' },
      { type: 'posts', q: 'Sintra' },
    ];
    for (const query of cases) {
      const sql = buildSearchSql(query.type, query, 'published', 21);
      const plan = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS) ${sql.text}`,
        sql.values,
      );
      console.log(
        `\n${JSON.stringify(query)}\n${plan.rows.map((row) => row['QUERY PLAN']).join('\n')}`,
      );
    }
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
