import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { fridgeItemsTable, ingredientsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/fridge", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const items = await db
      .select({
        id: fridgeItemsTable.id,
        userId: fridgeItemsTable.userId,
        ingredientId: fridgeItemsTable.ingredientId,
        status: fridgeItemsTable.status,
        bestBeforeDate: fridgeItemsTable.bestBeforeDate,
        lastSeenAt: fridgeItemsTable.lastSeenAt,
        source: fridgeItemsTable.source,
        ingredientName: ingredientsTable.name,
        ingredientCategory: ingredientsTable.category,
      })
      .from(fridgeItemsTable)
      .innerJoin(ingredientsTable, eq(fridgeItemsTable.ingredientId, ingredientsTable.id))
      .where(and(
        eq(fridgeItemsTable.userId, userId),
        inArray(fridgeItemsTable.status, ["likely_available", "maybe_low"])
      ));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to get fridge items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/fridge/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const itemId = parseInt(req.params["id"] as string);
    if (isNaN(itemId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const { status } = req.body;
    if (!status || !["likely_available", "maybe_low", "likely_gone"].includes(status)) {
      res.status(400).json({ error: "Ungültiger Status" });
      return;
    }

    const [item] = await db
      .select()
      .from(fridgeItemsTable)
      .where(and(eq(fridgeItemsTable.id, itemId), eq(fridgeItemsTable.userId, userId)));
    if (!item) { res.status(404).json({ error: "Item nicht gefunden" }); return; }

    const [updated] = await db
      .update(fridgeItemsTable)
      .set({ status, lastSeenAt: new Date() })
      .where(eq(fridgeItemsTable.id, itemId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update fridge item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
