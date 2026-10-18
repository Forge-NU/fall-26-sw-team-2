-- Story date (approved 2026-10-18): the day a story is from. Orders kept
-- stories on the trip page. Existing stories get the date they were created.

-- AlterTable: add nullable, backfill, then require it
ALTER TABLE "stories" ADD COLUMN "story_date" DATE;
UPDATE "stories" SET "story_date" = "created_at"::date;
ALTER TABLE "stories" ALTER COLUMN "story_date" SET NOT NULL;

-- Trip page order is now story_date, then created_at
DROP INDEX "stories_trip_id_created_at_idx";
CREATE INDEX "stories_trip_id_story_date_created_at_idx" ON "stories"("trip_id", "story_date", "created_at");
