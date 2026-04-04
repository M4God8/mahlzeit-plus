-- Migration: Scanner Score v2 — 4-pillar scoring system
-- Replaces old score columns (score_naturalness, score_nutrient_balance, score_quality_bonus)
-- with new ones (score_ingredients, score_nutrition, score_processing) and adds context fields.

ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS score_ingredients integer NOT NULL DEFAULT 0;
ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS score_nutrition integer NOT NULL DEFAULT 0;
ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS score_processing integer NOT NULL DEFAULT 0;
ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS context_label text;
ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS warning_flags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE scanned_products ADD COLUMN IF NOT EXISTS summary text;

UPDATE scanned_products SET score_ingredients = score_naturalness WHERE score_ingredients = 0 AND score_naturalness != 0;
UPDATE scanned_products SET score_nutrition = score_nutrient_balance WHERE score_nutrition = 0 AND score_nutrient_balance != 0;
UPDATE scanned_products SET score_processing = score_quality_bonus WHERE score_processing = 0 AND score_quality_bonus != 0;

ALTER TABLE scanned_products DROP COLUMN IF EXISTS score_naturalness;
ALTER TABLE scanned_products DROP COLUMN IF EXISTS score_nutrient_balance;
ALTER TABLE scanned_products DROP COLUMN IF EXISTS score_quality_bonus;
