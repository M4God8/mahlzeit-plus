import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { nutritionProfilesTable } from "./nutritionProfiles";

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  activeProfileIds: integer("active_profile_ids").array().notNull().default([]),
  householdSize: integer("household_size").notNull().default(2),
  budgetLevel: text("budget_level").notNull().default("medium"),
  cookTimeLimit: integer("cook_time_limit").notNull().default(30),
  bioPreferred: boolean("bio_preferred").notNull().default(false),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({ userId: true });
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;
