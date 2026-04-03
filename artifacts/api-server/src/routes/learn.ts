import { Router } from "express";
import { db } from "@workspace/db";
import { userLearnedPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { aggregateUserPreferences } from "../services/aggregateService";

const router = Router();

router.get("/learn/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [row] = await db
    .select()
    .from(userLearnedPreferencesTable)
    .where(eq(userLearnedPreferencesTable.userId, userId));

  if (!row) {
    res.status(404).json({ error: "Noch kein Lernprofil vorhanden" });
    return;
  }

  res.json(row);
});

router.delete("/learn/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;

  await db
    .delete(userLearnedPreferencesTable)
    .where(eq(userLearnedPreferencesTable.userId, userId));

  res.status(204).end();
});

router.post("/learn/aggregate", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const result = await aggregateUserPreferences(userId);
  res.json(result);
});

export default router;
