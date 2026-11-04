import { Prisma } from '../generated/prisma/client';
import type { SearchType } from 'shared-types';
import type { SearchQueryDto } from './dto/search-query.dto';
import type { SearchCursor } from './search-cursor';

function matching(fields: Prisma.Sql[], q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  return {
    where: Prisma.sql`(${Prisma.join(
      fields.map(
        (field) => Prisma.sql`(${field} ILIKE ${pattern} OR ${field} % ${q})`,
      ),
      ' OR ',
    )})`,
    score: Prisma.sql`round(GREATEST(${Prisma.join(fields.map((field) => Prisma.sql`similarity(COALESCE(${field}, ''), ${q})`))})::numeric, 6)`,
  };
}
function distance(query: SearchQueryDto): Prisma.Sql {
  if (query.radiusKm === undefined) return Prisma.sql`TRUE`;
  const center = Prisma.sql`ll_to_earth(${query.lat}::float8, ${query.lng}::float8)`;
  const point = Prisma.sql`ll_to_earth(l.latitude::float8, l.longitude::float8)`;
  const meters = query.radiusKm * 1000;
  return Prisma.sql`${point} <@ earth_box(${center}, ${meters}::float8)
    AND earth_distance(${point}, ${center}) <= ${meters}::float8`;
}
function rating(query: SearchQueryDto): Prisma.Sql {
  return query.minRating === undefined
    ? Prisma.sql`TRUE`
    : Prisma.sql`l.rating_count > 0 AND l.rating_sum >= ${query.minRating}::numeric * l.rating_count`;
}
function dateRange(query: SearchQueryDto, type: SearchType) {
  const start =
    type === 'trips' ? Prisma.sql`t.start_date` : Prisma.sql`p.visited_on`;
  const end =
    type === 'trips' ? Prisma.sql`t.end_date` : Prisma.sql`p.visited_on`;
  return Prisma.sql`${query.from ? Prisma.sql`${end} >= ${query.from}::date` : Prisma.sql`TRUE`}
    AND ${query.to ? Prisma.sql`${start} <= ${query.to}::date` : Prisma.sql`TRUE`}`;
}

export function buildSearchSql(
  type: SearchType,
  query: SearchQueryDto,
  publishedStatus: string,
  limit: number,
  cursor?: SearchCursor,
): Prisma.Sql {
  let source: Prisma.Sql;
  const published = Prisma.sql`t.status = ${publishedStatus}::trip_status`;
  if (type === 'people') {
    const match = matching(
      [
        Prisma.sql`u.username`,
        Prisma.sql`u.first_name`,
        Prisma.sql`u.last_name`,
        Prisma.sql`(u.first_name || ' ' || u.last_name)`,
      ],
      query.q,
    );
    source = Prisma.sql`SELECT u.id::text AS id, ${match.score} AS score, u.created_at AS newest FROM "User" u WHERE ${match.where}`;
  } else if (type === 'places') {
    const match = matching(
      [Prisma.sql`l.name`, Prisma.sql`l.city`, Prisma.sql`l.region`],
      query.q,
    );
    source = Prisma.sql`SELECT l.id::text AS id, ${match.score} AS score, l.created_at AS newest FROM locations l
      WHERE l.provider <> 'custom' AND ${match.where} AND ${distance(query)} AND ${rating(query)}
      AND EXISTS (SELECT 1 FROM posts p JOIN trips t ON t.id = p.trip_id WHERE p.location_id = l.id AND ${published})`;
  } else if (type === 'trips') {
    const match = matching(
      [
        Prisma.sql`t.title`,
        Prisma.sql`t.destination`,
        Prisma.sql`t.description`,
      ],
      query.q,
    );
    source = Prisma.sql`SELECT t.id::text AS id, ${match.score} AS score, t.published_at AS newest FROM trips t
      WHERE ${published} AND ${match.where} AND ${dateRange(query, type)}
      AND ${query.radiusKm === undefined ? Prisma.sql`TRUE` : Prisma.sql`EXISTS (SELECT 1 FROM posts p JOIN locations l ON l.id = p.location_id WHERE p.trip_id = t.id AND ${distance(query)})`}`;
  } else {
    const match = matching(
      [
        Prisma.sql`p.caption`,
        Prisma.sql`l.name`,
        Prisma.sql`p.custom_location_name`,
      ],
      query.q,
    );
    // Separate text candidates by table so PostgreSQL can use trigram indexes
    // instead of an OR across a join. IN deduplicates posts matching both.
    const postMatch = matching(
      [
        Prisma.sql`candidate.caption`,
        Prisma.sql`candidate.custom_location_name`,
      ],
      query.q,
    );
    const placeMatch = matching([Prisma.sql`place.name`], query.q);
    source = Prisma.sql`SELECT p.id::text AS id, ${match.score} AS score, p.created_at AS newest FROM posts p
      JOIN trips t ON t.id = p.trip_id LEFT JOIN locations l ON l.id = p.location_id
      WHERE ${published} AND p.id IN (
        SELECT candidate.id FROM posts candidate WHERE ${postMatch.where}
        UNION
        SELECT candidate.id FROM posts candidate JOIN locations place ON place.id = candidate.location_id WHERE ${placeMatch.where}
      ) AND ${dateRange(query, type)} AND ${distance(query)} AND ${rating(query)}`;
  }
  const sort =
    query.sort === 'newest'
      ? Prisma.sql`extract(epoch FROM newest)`
      : Prisma.sql`score`;
  return Prisma.sql`WITH matches AS (${source}), ranked AS (SELECT id, ${sort} AS sort_key FROM matches)
    SELECT id, sort_key::text AS key FROM ranked
    WHERE ${cursor ? Prisma.sql`(sort_key, id) < (${cursor.key}::numeric, ${cursor.id})` : Prisma.sql`TRUE`}
    ORDER BY sort_key DESC, id DESC LIMIT ${limit}`;
}
