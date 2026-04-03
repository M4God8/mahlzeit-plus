import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable, nutritionProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

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

    let profile = null;
    if (settings.profileId) {
      const [p] = await db.select().from(nutritionProfilesTable).where(eq(nutritionProfilesTable.id, settings.profileId));
      if (p) {
        profile = {
          id: p.id,
          name: p.name,
          description: p.description,
          excludedIngredients: p.excludedIngredients ?? [],
          preferredCategories: p.preferredCategories ?? [],
          mealStyle: p.mealStyle,
          energyLabel: p.energyLabel,
        };
      }
    }

    res.json({
      userId: settings.userId,
      profileId: settings.profileId,
      householdSize: settings.householdSize,
      budgetLevel: settings.budgetLevel,
      cookTimeLimit: settings.cookTimeLimit,
      bioPreferred: settings.bioPreferred,
      profile,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface UserSettingsBody {
  profileId?: number | null;
  householdSize?: number;
  budgetLevel?: string;
  cookTimeLimit?: number;
  bioPreferred?: boolean;
}

router.post("/user-settings", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const body = req.body as UserSettingsBody;
    const { profileId, householdSize, budgetLevel, cookTimeLimit, bioPreferred } = body;

    await db
      .insert(userSettingsTable)
      .values({
        userId,
        profileId: profileId ?? null,
        householdSize: householdSize ?? 2,
        budgetLevel: budgetLevel ?? "medium",
        cookTimeLimit: cookTimeLimit ?? 30,
        bioPreferred: bioPreferred ?? false,
      })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: {
          profileId: profileId ?? null,
          householdSize: householdSize ?? 2,
          budgetLevel: budgetLevel ?? "medium",
          cookTimeLimit: cookTimeLimit ?? 30,
          bioPreferred: bioPreferred ?? false,
        },
      });

    const [updated] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));

    let profile = null;
    if (updated?.profileId) {
      const [p] = await db.select().from(nutritionProfilesTable).where(eq(nutritionProfilesTable.id, updated.profileId));
      if (p) {
        profile = {
          id: p.id,
          name: p.name,
          description: p.description,
          excludedIngredients: p.excludedIngredients ?? [],
          preferredCategories: p.preferredCategories ?? [],
          mealStyle: p.mealStyle,
          energyLabel: p.energyLabel,
        };
      }
    }

    res.json({
      userId: updated!.userId,
      profileId: updated!.profileId,
      householdSize: updated!.householdSize,
      budgetLevel: updated!.budgetLevel,
      cookTimeLimit: updated!.cookTimeLimit,
      bioPreferred: updated!.bioPreferred,
      profile,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
