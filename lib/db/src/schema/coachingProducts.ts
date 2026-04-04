import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const coachingProductsTable = pgTable(
  "coaching_products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    url: text("url").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    triggerKeywords: text("trigger_keywords").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("coaching_products_is_active_idx").on(t.isActive),
  ]
);

export type CoachingProduct = typeof coachingProductsTable.$inferSelect;
export type InsertCoachingProduct = typeof coachingProductsTable.$inferInsert;
