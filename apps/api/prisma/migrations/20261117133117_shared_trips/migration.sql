-- Shared trips, buckets, saved places and notifications (#131 COLLAB-1).
-- Rules: docs/product/mvp-decisions.md (#129 DOC-3). Schema and endpoints:
-- docs/architecture/shared-trips.md.

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('trip_invite', 'trip_invite_accepted');

-- CreateEnum
CREATE TYPE "trip_invite_status" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "trip_id" UUID,
    "invite_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_saves" (
    "user_id" TEXT NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_saves_pkey" PRIMARY KEY ("user_id","location_id")
);

-- CreateTable
CREATE TABLE "trip_bucket_items" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "note" VARCHAR(280),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_bucket_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_invites" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "invitee_id" TEXT NOT NULL,
    "status" "trip_invite_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "trip_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_members" (
    "trip_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_members_pkey" PRIMARY KEY ("trip_id","user_id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "notifications_actor_id_idx" ON "notifications"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_trip_id_idx" ON "notifications"("trip_id");

-- CreateIndex
CREATE INDEX "notifications_invite_id_idx" ON "notifications"("invite_id");

-- CreateIndex
CREATE INDEX "place_saves_user_id_created_at_location_id_idx" ON "place_saves"("user_id", "created_at", "location_id");

-- CreateIndex
CREATE INDEX "place_saves_location_id_idx" ON "place_saves"("location_id");

-- CreateIndex
CREATE INDEX "trip_bucket_items_trip_id_created_at_id_idx" ON "trip_bucket_items"("trip_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "trip_bucket_items_added_by_id_idx" ON "trip_bucket_items"("added_by_id");

-- CreateIndex
CREATE INDEX "trip_bucket_items_location_id_idx" ON "trip_bucket_items"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_bucket_items_trip_id_location_id_key" ON "trip_bucket_items"("trip_id", "location_id");

-- CreateIndex
CREATE INDEX "trip_invites_trip_id_status_idx" ON "trip_invites"("trip_id", "status");

-- CreateIndex
CREATE INDEX "trip_invites_invitee_id_idx" ON "trip_invites"("invitee_id");

-- CreateIndex
CREATE INDEX "trip_invites_inviter_id_idx" ON "trip_invites"("inviter_id");

-- CreateIndex
CREATE INDEX "trip_members_user_id_joined_at_idx" ON "trip_members"("user_id", "joined_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "trip_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_saves" ADD CONSTRAINT "place_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_saves" ADD CONSTRAINT "place_saves_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_bucket_items" ADD CONSTRAINT "trip_bucket_items_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_bucket_items" ADD CONSTRAINT "trip_bucket_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_bucket_items" ADD CONSTRAINT "trip_bucket_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma can't express partial indexes or check constraints, so these are by hand.

-- One pending invite per person per trip. Answered and cancelled invites
-- don't count, so the owner can invite someone again after a decline.
CREATE UNIQUE INDEX "trip_invites_one_pending_key" ON "trip_invites"("trip_id", "invitee_id") WHERE "status" = 'pending';

ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_no_self_invite" CHECK ("inviter_id" <> "invitee_id");
ALTER TABLE "trip_invites" ADD CONSTRAINT "trip_invites_responded_at_check" CHECK (("status" = 'pending') = ("responded_at" IS NULL));

-- The unread badge
CREATE INDEX "notifications_unread_idx" ON "notifications"("recipient_id") WHERE "read_at" IS NULL;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_no_self_notify" CHECK ("recipient_id" <> "actor_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_invite_check" CHECK ("type" <> 'trip_invite' OR ("trip_id" IS NOT NULL AND "invite_id" IS NOT NULL));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_invite_accepted_check" CHECK ("type" <> 'trip_invite_accepted' OR "trip_id" IS NOT NULL);
