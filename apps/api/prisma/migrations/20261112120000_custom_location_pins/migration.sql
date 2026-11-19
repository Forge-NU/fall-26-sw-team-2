-- #94 LOC-2: dropped pins are locations rows with provider = 'custom'.

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "created_by" TEXT;

-- CreateIndex
CREATE INDEX "locations_created_by_idx" ON "locations"("created_by");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints (Prisma can't express these in the schema)
ALTER TABLE "locations" ADD CONSTRAINT "locations_provider_check" CHECK ("provider" IN ('mapbox', 'custom'));
-- Only a pin has an owner. Null on a pin once its user is deleted (SET NULL
-- above), until something deletes the pin.
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_check" CHECK ("created_by" IS NULL OR "provider" = 'custom');

-- For the cleanup job's sweep of pins nobody attached
CREATE INDEX "locations_custom_created_at_idx" ON "locations"("created_at") WHERE "provider" = 'custom';

-- A pin belongs to the one post or story that uses it, so once that post or
-- story stops using it (deleted, deleted by a cascade from its trip or user,
-- expired, or moved to another location), the pin goes too. A trigger rather
-- than app code, so the cascades that never reach the app are covered.
-- Mapbox places are shared and never deleted. The NOT EXISTS checks are a
-- guard: the API never lets a second post or story use a pin.
CREATE FUNCTION "delete_unused_custom_location"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.location_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.location_id IS DISTINCT FROM OLD.location_id) THEN
    DELETE FROM locations l
    WHERE l.id = OLD.location_id
      AND l.provider = 'custom'
      AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.location_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.location_id = l.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "posts_delete_unused_custom_location"
AFTER DELETE OR UPDATE OF "location_id" ON "posts"
FOR EACH ROW EXECUTE FUNCTION "delete_unused_custom_location"();

CREATE TRIGGER "stories_delete_unused_custom_location"
AFTER DELETE OR UPDATE OF "location_id" ON "stories"
FOR EACH ROW EXECUTE FUNCTION "delete_unused_custom_location"();
