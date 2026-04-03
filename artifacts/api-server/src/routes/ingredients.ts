import { Router } from "express";
import { db } from "@workspace/db";
import { ingredientsTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";

const router = Router();

router.get("/ingredients", async (req, res): Promise<void> => {
  try {
    const { category, search } = req.query as { category?: string; search?: string };

    let query = db.select().from(ingredientsTable);
    const conditions = [];

    if (category) {
      conditions.push(eq(ingredientsTable.category, category));
    }
    if (search) {
      conditions.push(ilike(ingredientsTable.name, `%${search}%`));
    }

    const results = conditions.length > 0
      ? await db.select().from(ingredientsTable).where(and(...conditions))
      : await query;

    res.json(results.map(i => ({
      id: i.id,
      name: i.name,
      category: i.category,
      defaultUnit: i.defaultUnit,
      bioRecommended: i.bioRecommended,
      scoreBase: i.scoreBase,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list ingredients");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
