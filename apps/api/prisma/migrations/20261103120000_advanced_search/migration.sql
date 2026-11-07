CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

CREATE INDEX IF NOT EXISTS search_trips_title_trgm ON trips USING gin (title gin_trgm_ops) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS search_trips_destination_trgm ON trips USING gin (destination gin_trgm_ops) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS search_trips_description_trgm ON trips USING gin (description gin_trgm_ops) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS search_posts_caption_trgm ON posts USING gin (caption gin_trgm_ops);
CREATE INDEX IF NOT EXISTS search_posts_custom_location_trgm ON posts USING gin (custom_location_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS search_locations_earth ON locations USING gist (ll_to_earth(latitude::float8, longitude::float8));
CREATE INDEX IF NOT EXISTS search_trips_dates ON trips (start_date, end_date) WHERE status = 'published';
