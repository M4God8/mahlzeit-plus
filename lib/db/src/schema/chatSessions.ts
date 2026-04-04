import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const chatSessionsTable = pgTable(
  "chat_sessions",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    messageCount: integer("message_count").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
  },
  (t) => [
    index("chat_sessions_user_id_idx").on(t.userId),
    index("chat_sessions_created_at_idx").on(t.createdAt),
  ]
);

export type ChatSession = typeof chatSessionsTable.$inferSelect;
export type InsertChatSession = typeof chatSessionsTable.$inferInsert;
