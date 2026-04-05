import { pgTable, serial, text, integer, boolean, timestamp, time, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { recipesTable } from "./recipes";

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  cycleLengthDays: integer("cycle_length_days").notNull().default(7),
  repeatEnabled: boolean("repeat_enabled").notNull().default(false),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanDaysTable = pgTable("meal_plan_days", {
  id: serial("id").primaryKey(),
  mealPlanId: integer("meal_plan_id").notNull().references(() => mealPlansTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
});

export const mealEntriesTable = pgTable("meal_entries", {
  id: serial("id").primaryKey(),
  mealPlanDayId: integer("meal_plan_day_id").notNull().references(() => mealPlanDaysTable.id, { onDelete: "cascade" }),
  mealType: text("meal_type").notNull().default("lunch"),
  recipeId: integer("recipe_id").references(() => recipesTable.id),
  customNote: text("custom_note"),
  timeSlot: time("time_slot"),
  overrideCookTime: integer("override_cook_time"),
  overrideServings: integer("override_servings"),
  repeatDays: integer("repeat_days").notNull().default(1),
  repeatedFromEntryId: integer("repeated_from_entry_id").references((): AnyPgColumn => mealEntriesTable.id, { onDelete: "cascade" }),
});

export const insertMealPlanSchema = createInsertSchema(mealPlansTable).omit({ id: true, createdAt: true });
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlansTable.$inferSelect;
export type MealPlanDay = typeof mealPlanDaysTable.$inferSelect;
export type MealEntry = typeof mealEntriesTable.$inferSelect;
