import { pgTable, serial, text, integer, timestamp, date, unique } from "drizzle-orm/pg-core";
import { ingredientsTable } from "./ingredients";

export const spoilageDefaultsTable = pgTable("spoilage_defaults", {
  id: serial("id").primaryKey(),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredientsTable.id, { onDelete: "cascade" }),
  typicalDaysFresh: integer("typical_days_fresh").notNull().default(7),
  spoilageSpeed: text("spoilage_speed").notNull().default("slow"),
  trackByDefault: text("track_by_default").notNull().default("no"),
}, (t) => [
  unique("spoilage_defaults_ingredient_unique").on(t.ingredientId),
]);

export const fridgeItemsTable = pgTable("fridge_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredientsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("likely_available"),
  bestBeforeDate: date("best_before_date"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("shopping"),
});

export type SpoilageDefault = typeof spoilageDefaultsTable.$inferSelect;
export type FridgeItem = typeof fridgeItemsTable.$inferSelect;
