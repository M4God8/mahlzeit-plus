-- Phase 8: Recipe Screenshot Import
-- Adds source tracking columns to recipes table
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS)

ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "source_note" TEXT;
