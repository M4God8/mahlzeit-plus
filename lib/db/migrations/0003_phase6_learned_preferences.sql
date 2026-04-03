-- Phase 6: User Learned Preferences
-- Creates the user_learned_preferences table for personalisation engine
-- Safe to run multiple times (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS "user_learned_preferences" (
  "user_id" TEXT PRIMARY KEY,
  "avg_preferred_prep_time" INTEGER,
  "frequently_replaced_recipe_ids" INTEGER[] NOT NULL DEFAULT '{}',
  "preferred_meal_complexity" TEXT NOT NULL DEFAULT 'mixed',
  "insight_message" TEXT,
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
