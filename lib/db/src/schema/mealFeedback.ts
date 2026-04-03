import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const mealFeedbackTable = pgTable("meal_feedback", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mealEntryId: integer("meal_entry_id"),
  recipeId: integer("recipe_id"),
  rating: text("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MealFeedback = typeof mealFeedbackTable.$inferSelect;
export type InsertMealFeedback = typeof mealFeedbackTable.$inferInsert;
