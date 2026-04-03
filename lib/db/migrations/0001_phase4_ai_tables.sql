-- Phase 4: Add AI generation logging and meal feedback tables
-- Safe to apply on top of existing schema provisioned via drizzle-kit push.
-- For fresh databases, 0000_neat_maddog.sql provides the full baseline.

CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "input" text NOT NULL,
  "output" jsonb,
  "model" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ai_generations_user_id_idx" ON "ai_generations" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generations_type_idx" ON "ai_generations" ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generations_created_at_idx" ON "ai_generations" ("created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "meal_feedback" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "meal_entry_id" integer,
  "recipe_id" integer,
  "rating" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "meal_feedback_rating_check" CHECK (rating IN ('thumbs_up', 'neutral', 'thumbs_down'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "meal_feedback_user_id_idx" ON "meal_feedback" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meal_feedback_meal_entry_id_idx" ON "meal_feedback" ("meal_entry_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meal_feedback_recipe_id_idx" ON "meal_feedback" ("recipe_id");
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "meal_feedback"
    ADD CONSTRAINT "meal_feedback_meal_entry_id_meal_entries_id_fk"
    FOREIGN KEY ("meal_entry_id") REFERENCES "meal_entries"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "meal_feedback"
    ADD CONSTRAINT "meal_feedback_recipe_id_recipes_id_fk"
    FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
