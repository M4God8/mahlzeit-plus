import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const aiGenerationsTable = pgTable(
  "ai_generations",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    input: text("input").notNull(),
    output: jsonb("output"),
    model: text("model").notNull().default("claude-sonnet-4-6"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("ai_generations_user_id_idx").on(t.userId),
    index("ai_generations_type_idx").on(t.type),
    index("ai_generations_created_at_idx").on(t.createdAt),
  ]
);

export type AiGeneration = typeof aiGenerationsTable.$inferSelect;
export type InsertAiGeneration = typeof aiGenerationsTable.$inferInsert;
