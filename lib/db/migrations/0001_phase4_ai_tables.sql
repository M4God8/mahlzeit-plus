-- Phase 4: Add AI generation logging and meal feedback tables
-- This migration adds only the two new tables introduced in Phase 4 (KI layer).
-- Safe to apply on top of existing schema that was provisioned via drizzle-kit push.
-- For fresh databases, apply 0000_neat_maddog.sql instead (contains full baseline).

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

CREATE TABLE IF NOT EXISTS "meal_feedback" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "meal_entry_id" integer,
  "recipe_id" integer,
  "rating" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
