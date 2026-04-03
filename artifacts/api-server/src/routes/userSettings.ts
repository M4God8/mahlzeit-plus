import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, nutritionProfilesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function fetchProfilesByIds(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(nutritionProfilesTable)
    .where(inArray(nutritionProfilesTable.id, ids));
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    excludedIngredients: p.excludedIngredients ?? [],
    preferredCategories: p.preferredCategories ?? [],
    mealStyle: p.mealStyle,
    energyLabel: p.energyLabel,
  }));
}

router.get("/user-settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const [settings] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId));

    if (!settings) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const profiles = await fetchProfilesByIds(settings.activeProfileIds);

    res.json({
      userId: settings.userId,
      activeProfileIds: settings.activeProfileIds,
      householdSize: settings.householdSize,
      budgetLevel: settings.budgetLevel,
      cookTimeLimit: settings.cookTimeLimit,
      bioPreferred: settings.bioPreferred,
      profiles,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface UserSettingsBody {
  activeProfileIds?: number[];
  householdSize?: number;
  budgetLevel?: string;
  cookTimeLimit?: number;
  bioPreferred?: boolean;
}

router.post("/user-settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const body = req.body as UserSettingsBody;
    const { activeProfileIds, householdSize, budgetLevel, cookTimeLimit, bioPreferred } = body;

    const ids = [...new Set(activeProfileIds ?? [])];
    if (ids.length < 1 || ids.length > 3) {
      res.status(400).json({ error: "activeProfileIds must contain 1–3 unique entries" });
      return;
    }

    const existingProfiles = await db
      .select({ id: nutritionProfilesTable.id })
      .from(nutritionProfilesTable)
      .where(inArray(nutritionProfilesTable.id, ids));
    const validIds = new Set(existingProfiles.map((p) => p.id));
    const invalidIds = ids.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      res.status(400).json({ error: `Invalid profile IDs: ${invalidIds.join(", ")}` });
      return;
    }

    await db
      .insert(userSettingsTable)
      .values({
        userId,
        activeProfileIds: ids,
        householdSize: householdSize ?? 2,
        budgetLevel: budgetLevel ?? "medium",
        cookTimeLimit: cookTimeLimit ?? 30,
        bioPreferred: bioPreferred ?? false,
      })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: {
          activeProfileIds: ids,
          householdSize: householdSize ?? 2,
          budgetLevel: budgetLevel ?? "medium",
          cookTimeLimit: cookTimeLimit ?? 30,
          bioPreferred: bioPreferred ?? false,
        },
      });

    const [updated] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));

    const profiles = await fetchProfilesByIds(updated!.activeProfileIds);

    res.json({
      userId: updated!.userId,
      activeProfileIds: updated!.activeProfileIds,
      householdSize: updated!.householdSize,
      budgetLevel: updated!.budgetLevel,
      cookTimeLimit: updated!.cookTimeLimit,
      bioPreferred: updated!.bioPreferred,
      profiles,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
