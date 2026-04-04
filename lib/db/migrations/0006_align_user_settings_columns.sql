-- Align user_settings column names with Drizzle schema
-- Renames columns added in 0004 to their current names
-- Safe to run on DBs that already have the correct column names

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'is_blocked') THEN
    ALTER TABLE "user_settings" RENAME COLUMN "is_blocked" TO "blocked";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'is_premium') THEN
    ALTER TABLE "user_settings" DROP COLUMN "is_premium";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'premium_expires_at') THEN
    ALTER TABLE "user_settings" RENAME COLUMN "premium_expires_at" TO "premium_until";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'premium_until') THEN
    ALTER TABLE "user_settings" ADD COLUMN "premium_until" TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'blocked') THEN
    ALTER TABLE "user_settings" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
