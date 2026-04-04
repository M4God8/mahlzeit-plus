import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const householdsTable = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  inviteCode: text("invite_code").unique(),
  inviteCodeExpiresAt: timestamp("invite_code_expires_at", { withTimezone: true }),
  maxMembers: integer("max_members").notNull().default(6),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const householdMembersTable = pgTable("household_members", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull().references(() => householdsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().unique(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Household = typeof householdsTable.$inferSelect;
export type HouseholdMember = typeof householdMembersTable.$inferSelect;
