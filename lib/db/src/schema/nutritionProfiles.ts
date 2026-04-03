import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nutritionProfilesTable = pgTable("nutrition_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  excludedIngredients: text("excluded_ingredients").array().notNull().default([]),
  preferredCategories: text("preferred_categories").array().notNull().default([]),
  mealStyle: text("meal_style").notNull().default("varied"),
  energyLabel: text("energy_label").notNull().default("leicht"),
});

export const insertNutritionProfileSchema = createInsertSchema(nutritionProfilesTable).omit({ id: true });
export type InsertNutritionProfile = z.infer<typeof insertNutritionProfileSchema>;
export type NutritionProfile = typeof nutritionProfilesTable.$inferSelect;
