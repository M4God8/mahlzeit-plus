-- Phase 5: Add scanned_products table for Barcode Scanner & Score-System

CREATE TABLE IF NOT EXISTS "scanned_products" (
  "id" serial PRIMARY KEY NOT NULL,
  "barcode" text NOT NULL,
  "user_id" text NOT NULL,
  "product_name" text,
  "brand" text,
  "image_url" text,
  "ingredients" text,
  "nutriments" jsonb,
  "labels" text[] NOT NULL DEFAULT '{}',
  "score_naturalness" integer NOT NULL DEFAULT 0,
  "score_nutrient_balance" integer NOT NULL DEFAULT 0,
  "score_profile_fit" integer NOT NULL DEFAULT 0,
  "score_quality_bonus" integer NOT NULL DEFAULT 0,
  "total_score" integer NOT NULL DEFAULT 0,
  "profile_fit_exclusions" text[] NOT NULL DEFAULT '{}',
  "scanned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "scanned_products_barcode_idx" ON "scanned_products" ("barcode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scanned_products_user_id_idx" ON "scanned_products" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scanned_products_scanned_at_idx" ON "scanned_products" ("scanned_at");
