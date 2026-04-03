import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const aiGenerationsTable = pgTable("ai_generations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  input: text("input").notNull(),
  output: jsonb("output"),
  model: text("model").notNull().default("claude-sonnet-4-6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiGeneration = typeof aiGenerationsTable.$inferSelect;
export type InsertAiGeneration = typeof aiGenerationsTable.$inferInsert;
