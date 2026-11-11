-- CreateTable
CREATE TABLE "post_likes" (
    "user_id" TEXT NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("user_id","post_id")
);

-- CreateTable
CREATE TABLE "post_saves" (
    "user_id" TEXT NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_saves_pkey" PRIMARY KEY ("user_id","post_id")
);

-- CreateTable
CREATE TABLE "trip_saves" (
    "user_id" TEXT NOT NULL,
    "trip_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_saves_pkey" PRIMARY KEY ("user_id","trip_id")
);

-- CreateIndex
CREATE INDEX "post_likes_post_id_created_at_user_id_idx" ON "post_likes"("post_id", "created_at", "user_id");

-- CreateIndex
CREATE INDEX "post_saves_user_id_created_at_post_id_idx" ON "post_saves"("user_id", "created_at", "post_id");

-- CreateIndex
CREATE INDEX "post_saves_post_id_idx" ON "post_saves"("post_id");

-- CreateIndex
CREATE INDEX "trip_saves_user_id_created_at_trip_id_idx" ON "trip_saves"("user_id", "created_at", "trip_id");

-- CreateIndex
CREATE INDEX "trip_saves_trip_id_idx" ON "trip_saves"("trip_id");

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_saves" ADD CONSTRAINT "post_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_saves" ADD CONSTRAINT "trip_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_saves" ADD CONSTRAINT "trip_saves_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

