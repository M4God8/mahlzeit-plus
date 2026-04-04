import { pgTable, serial, text, boolean, integer, unique, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ingredientsTable = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  defaultUnit: text("default_unit").notNull().default("g"),
  bioRecommended: boolean("bio_recommended").notNull().default(false),
  scoreBase: integer("score_base").notNull().default(50),
  priceMin: decimal("price_min", { precision: 6, scale: 2 }),
  priceMax: decimal("price_max", { precision: 6, scale: 2 }),
  priceAvg: decimal("price_avg", { precision: 6, scale: 2 }),
  priceUnit: text("price_unit"),
  priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
}, (t) => [
  unique("ingredients_name_unique").on(t.name),
]);

export const insertIngredientSchema = createInsertSchema(ingredientsTable).omit({ id: true });
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Ingredient = typeof ingredientsTable.$inferSelect;
