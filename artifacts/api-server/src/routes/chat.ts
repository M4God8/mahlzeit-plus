import { Router } from "express";
import { db, chatSessionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router = Router();

const chatMessageBody = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional().default([]),
});

router.post("/chat/message", requireAuth, async (req, res) => {
  try {
    const parsed = chatMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Nachricht", details: parsed.error.flatten() });
      return;
    }

    const userId = req.userId!;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaySession] = await db
      .select()
      .from(chatSessionsTable)
      .where(
        and(
          eq(chatSessionsTable.userId, userId),
          gte(chatSessionsTable.createdAt, todayStart),
        )
      )
      .orderBy(desc(chatSessionsTable.createdAt))
      .limit(1);

    if (todaySession) {
      await db
        .update(chatSessionsTable)
        .set({
          messageCount: todaySession.messageCount + 1,
          totalTokens: todaySession.totalTokens + 50,
        })
        .where(eq(chatSessionsTable.id, todaySession.id));
    } else {
      await db.insert(chatSessionsTable).values({
        userId,
        messageCount: 1,
        totalTokens: 50,
      });
    }

    res.json({
      reply: "Danke für deine Nachricht! Die Chat-Logik wird bald aktiviert. Ich werde dir dann als dein bewusster Ernährungsbegleiter zur Seite stehen. 🌿",
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to process chat message");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
