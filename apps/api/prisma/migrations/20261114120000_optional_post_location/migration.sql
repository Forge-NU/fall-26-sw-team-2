-- #143 POST-4: a post's location is optional. It can be a locations row (a
-- Mapbox place or a dropped pin), a custom name, or nothing, but not both,
-- the same rule stories already have. posts_rating_location_check is
-- unchanged, so a post with no location still can't be rated.
ALTER TABLE "posts" DROP CONSTRAINT "posts_location_check";
ALTER TABLE "posts" ADD CONSTRAINT "posts_location_check" CHECK (NOT ("location_id" IS NOT NULL AND "custom_location_name" IS NOT NULL));
