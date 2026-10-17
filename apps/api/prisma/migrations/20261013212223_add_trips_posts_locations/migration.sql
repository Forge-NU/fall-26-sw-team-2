-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "trip_status" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "provider_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "country_code" CHAR(2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "s3_key" TEXT NOT NULL,
    "media_type" "media_type" NOT NULL,
    "position" SMALLINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "location_id" UUID,
    "custom_location_name" VARCHAR(100),
    "caption" VARCHAR(2200),
    "visited_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "destination" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "trip_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_latitude_longitude_idx" ON "locations"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "locations_provider_provider_place_id_key" ON "locations"("provider", "provider_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_s3_key_key" ON "post_media"("s3_key");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_post_id_position_key" ON "post_media"("post_id", "position");

-- CreateIndex
CREATE INDEX "posts_trip_id_visited_on_created_at_idx" ON "posts"("trip_id", "visited_on", "created_at");

-- CreateIndex
CREATE INDEX "posts_location_id_idx" ON "posts"("location_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "trips_owner_id_start_date_idx" ON "trips"("owner_id", "start_date");

-- CreateIndex
CREATE INDEX "trips_status_published_at_idx" ON "trips"("status", "published_at");

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints (Prisma can't express these in the schema)
ALTER TABLE "trips" ADD CONSTRAINT "trips_dates_check" CHECK ("end_date" >= "start_date");
ALTER TABLE "trips" ADD CONSTRAINT "trips_published_at_check" CHECK (("status" = 'published') = ("published_at" IS NOT NULL));

ALTER TABLE "posts" ADD CONSTRAINT "posts_location_check" CHECK (("location_id" IS NULL) <> ("custom_location_name" IS NULL));

ALTER TABLE "post_media" ADD CONSTRAINT "post_media_position_check" CHECK ("position" BETWEEN 0 AND 29);

ALTER TABLE "locations" ADD CONSTRAINT "locations_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "locations" ADD CONSTRAINT "locations_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180);
