-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating_sum" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "rating" SMALLINT;

-- Check constraints (Prisma can't express these in the schema)
ALTER TABLE "posts" ADD CONSTRAINT "posts_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
-- Only posts at a Mapbox place can be rated: a custom location has no shared
-- place to average into
ALTER TABLE "posts" ADD CONSTRAINT "posts_rating_location_check" CHECK ("rating" IS NULL OR "location_id" IS NOT NULL);

-- The totals are recomputed by refreshLocationRatings; this catches a broken
-- recompute right away
ALTER TABLE "locations" ADD CONSTRAINT "locations_rating_totals_check" CHECK ("rating_count" >= 0 AND "rating_sum" BETWEEN "rating_count" AND 5 * "rating_count");
