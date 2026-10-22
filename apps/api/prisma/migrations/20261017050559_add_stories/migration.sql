-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "trip_id" UUID,
    "location_id" UUID,
    "custom_location_name" VARCHAR(100),
    "s3_key" TEXT NOT NULL,
    "text" VARCHAR(200),
    "keep_on_trip" BOOLEAN NOT NULL DEFAULT false,
    "story_date" DATE NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT (now() + '24:00:00'::interval),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stories_s3_key_key" ON "stories"("s3_key");

-- CreateIndex
CREATE INDEX "stories_owner_id_expires_at_idx" ON "stories"("owner_id", "expires_at");

-- CreateIndex
CREATE INDEX "stories_trip_id_story_date_created_at_idx" ON "stories"("trip_id", "story_date", "created_at");

-- CreateIndex
CREATE INDEX "stories_expires_at_idx" ON "stories"("expires_at");

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints (Prisma can't express these in the schema)
ALTER TABLE "stories" ADD CONSTRAINT "stories_keep_on_trip_check" CHECK (NOT "keep_on_trip" OR "trip_id" IS NOT NULL);
ALTER TABLE "stories" ADD CONSTRAINT "stories_location_check" CHECK ("location_id" IS NULL OR "custom_location_name" IS NULL);
