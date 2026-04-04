DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='blocked') THEN
    ALTER TABLE user_settings RENAME COLUMN blocked TO is_blocked;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_settings' AND column_name='premium_until') THEN
    ALTER TABLE user_settings RENAME COLUMN premium_until TO premium_expires_at;
  END IF;
END $$;

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "is_premium" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "spoilage_defaults" (
  "id" serial PRIMARY KEY NOT NULL,
  "ingredient_id" integer NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "typical_days_fresh" integer NOT NULL DEFAULT 7,
  "spoilage_speed" text NOT NULL DEFAULT 'slow',
  "track_by_default" text NOT NULL DEFAULT 'no',
  CONSTRAINT "spoilage_defaults_ingredient_unique" UNIQUE("ingredient_id")
);

CREATE TABLE IF NOT EXISTS "fridge_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "ingredient_id" integer NOT NULL REFERENCES "ingredients"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'likely_available',
  "best_before_date" date,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "source" text NOT NULL DEFAULT 'shopping'
);
