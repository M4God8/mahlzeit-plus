ALTER TABLE "ingredients" ADD COLUMN "price_min" numeric(6, 2);
ALTER TABLE "ingredients" ADD COLUMN "price_max" numeric(6, 2);
ALTER TABLE "ingredients" ADD COLUMN "price_avg" numeric(6, 2);
ALTER TABLE "ingredients" ADD COLUMN "price_unit" text;
ALTER TABLE "ingredients" ADD COLUMN "price_updated_at" timestamp with time zone;
