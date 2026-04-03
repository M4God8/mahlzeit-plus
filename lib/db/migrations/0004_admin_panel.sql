-- Phase 7: Admin Panel
-- Adds admin role, premium, blocked status to user_settings
-- Adds token tracking and cost columns to ai_generations
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "is_premium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "premium_expires_at" TIMESTAMP;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "is_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "cost_eur" NUMERIC(10, 6);
