import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ingredientsTable } from "./ingredients";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull(),
  description: text("description"),
  prepTime: integer("prep_time").notNull().default(10),
  cookTime: integer("cook_time").notNull().default(20),
  servings: integer("servings").notNull().default(2),
  instructions: text("instructions").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  energyType: text("energy_type").notNull().default("leicht"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipeIngredientsTable = pgTable("recipe_ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id").references(() => ingredientsTable.id),
  customName: text("custom_name"),
  amount: text("amount").notNull().default("1"),
  unit: text("unit").notNull().default("g"),
  optional: boolean("optional").notNull().default(false),
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true, createdAt: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;
export type RecipeIngredient = typeof recipeIngredientsTable.$inferSelect;
