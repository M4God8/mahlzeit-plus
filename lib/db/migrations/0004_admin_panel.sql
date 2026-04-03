ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "blocked" boolean NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "premium_until" timestamp;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;

ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "input_tokens" integer;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "output_tokens" integer;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "cost_eur" numeric;
