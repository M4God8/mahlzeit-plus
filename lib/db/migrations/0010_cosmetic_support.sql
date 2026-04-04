ALTER TABLE "scanned_products" ADD COLUMN "product_type" text DEFAULT 'food' NOT NULL;
ALTER TABLE "scanned_products" ADD COLUMN "fluoride_note" text;