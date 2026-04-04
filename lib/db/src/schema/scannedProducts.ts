import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const scannedProductsTable = pgTable(
  "scanned_products",
  {
    id: serial("id").primaryKey(),
    barcode: text("barcode").notNull(),
    userId: text("user_id").notNull(),
    productName: text("product_name"),
    brand: text("brand"),
    imageUrl: text("image_url"),
    ingredients: text("ingredients"),
    nutriments: jsonb("nutriments"),
    labels: text("labels").array().notNull().default([]),
    productType: text("product_type").notNull().default("food"),
    scoreIngredients: integer("score_ingredients").notNull().default(0),
    scoreNutrition: integer("score_nutrition").notNull().default(0),
    scoreProcessing: integer("score_processing").notNull().default(0),
    scoreProfileFit: integer("score_profile_fit").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    profileFitExclusions: text("profile_fit_exclusions").array().notNull().default([]),
    fluorideNote: text("fluoride_note"),
    contextLabel: text("context_label"),
    warningFlags: text("warning_flags").array().notNull().default([]),
    summary: text("summary"),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  },
  (t) => [
    index("scanned_products_barcode_idx").on(t.barcode),
    index("scanned_products_user_id_idx").on(t.userId),
    index("scanned_products_scanned_at_idx").on(t.scannedAt),
  ]
);

export type ScannedProduct = typeof scannedProductsTable.$inferSelect;
export type InsertScannedProduct = typeof scannedProductsTable.$inferInsert;
