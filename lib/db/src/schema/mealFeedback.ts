import { pgTable, serial, text, integer, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { mealEntriesTable } from "./mealPlans";
import { recipesTable } from "./recipes";

export const mealFeedbackTable = pgTable(
  "meal_feedback",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    mealEntryId: integer("meal_entry_id").references(() => mealEntriesTable.id, { onDelete: "set null" }),
    recipeId: integer("recipe_id").references(() => recipesTable.id, { onDelete: "set null" }),
    rating: text("rating").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("meal_feedback_user_id_idx").on(t.userId),
    index("meal_feedback_meal_entry_id_idx").on(t.mealEntryId),
    index("meal_feedback_recipe_id_idx").on(t.recipeId),
    check("meal_feedback_rating_check", sql`${t.rating} IN ('up', 'neutral', 'down')`),
  ]
);

export type MealFeedback = typeof mealFeedbackTable.$inferSelect;
export type InsertMealFeedback = typeof mealFeedbackTable.$inferInsert;
