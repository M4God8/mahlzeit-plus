import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { mealPlansTable } from "./mealPlans";
import { ingredientsTable } from "./ingredients";

export const shoppingListsTable = pgTable("shopping_lists", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  weekFrom: text("week_from").notNull(),
  weekTo: text("week_to").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  mealPlanId: integer("meal_plan_id").references(() => mealPlansTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingListItemsTable = pgTable("shopping_list_items", {
  id: serial("id").primaryKey(),
  shoppingListId: integer("shopping_list_id").notNull().references(() => shoppingListsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: text("amount"),
  unit: text("unit"),
  category: text("category").notNull().default("Sonstiges"),
  isChecked: boolean("is_checked").notNull().default(false),
  bioRecommended: boolean("bio_recommended").notNull().default(false),
  isManual: boolean("is_manual").notNull().default(false),
  ingredientId: integer("ingredient_id").references(() => ingredientsTable.id, { onDelete: "set null" }),
});

export type ShoppingList = typeof shoppingListsTable.$inferSelect;
export type ShoppingListItem = typeof shoppingListItemsTable.$inferSelect;
