-- Webhook-created accounts have no application username until onboarding.
ALTER TABLE "User" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- PostgreSQL's ordinary unique index is case-sensitive. This index makes
-- username identity case-insensitive while allowing multiple NULL values.
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (LOWER("username"));
