import { Router } from "express";
import { db } from "@workspace/db";
import { nutritionProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/nutrition-profiles", async (req, res): Promise<void> => {
  try {
    const profiles = await db.select().from(nutritionProfilesTable);
    res.json(profiles.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      excludedIngredients: p.excludedIngredients ?? [],
      preferredCategories: p.preferredCategories ?? [],
      mealStyle: p.mealStyle,
      energyLabel: p.energyLabel,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list nutrition profiles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/nutrition-profiles/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [profile] = await db.select().from(nutritionProfilesTable).where(eq(nutritionProfilesTable.id, id));
    if (!profile) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      excludedIngredients: profile.excludedIngredients ?? [],
      preferredCategories: profile.preferredCategories ?? [],
      mealStyle: profile.mealStyle,
      energyLabel: profile.energyLabel,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get nutrition profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
