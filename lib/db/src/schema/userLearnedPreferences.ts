import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const userLearnedPreferencesTable = pgTable("user_learned_preferences", {
  userId: text("user_id").primaryKey(),
  avgPreferredPrepTime: integer("avg_preferred_prep_time"),
  frequentlyReplacedRecipeIds: integer("frequently_replaced_recipe_ids").array().notNull().default([]),
  preferredMealComplexity: text("preferred_meal_complexity").notNull().default("mixed"),
  insightMessage: text("insight_message"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserLearnedPreferences = typeof userLearnedPreferencesTable.$inferSelect;
export type InsertUserLearnedPreferences = typeof userLearnedPreferencesTable.$inferInsert;
