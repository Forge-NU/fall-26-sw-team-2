-- Trigram matching for people and place search (SRCH-1). Prisma can't declare
-- extensions without a preview feature, so it's enabled here.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_first_name_trgm_idx" ON "User" USING GIN ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_last_name_trgm_idx" ON "User" USING GIN ("last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "locations_name_trgm_idx" ON "locations" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "locations_city_trgm_idx" ON "locations" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "locations_region_trgm_idx" ON "locations" USING GIN ("region" gin_trgm_ops);
