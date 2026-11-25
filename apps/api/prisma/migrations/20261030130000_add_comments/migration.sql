-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_comment_id" UUID,
    "reply_to_user_id" TEXT,
    "body" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_post_id_parent_comment_id_created_at_id_idx" ON "comments"("post_id", "parent_comment_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "comments_parent_comment_id_created_at_id_idx" ON "comments"("parent_comment_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "comments_reply_to_user_id_idx" ON "comments"("reply_to_user_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_user_id_fkey" FOREIGN KEY ("reply_to_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints (Prisma can't express these)
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_check" CHECK (char_length("body") >= 1);
ALTER TABLE "comments" ADD CONSTRAINT "comments_not_own_parent_check" CHECK ("parent_comment_id" <> "id");
