import { Router } from "express";
import { db } from "@workspace/db";
import { mealPlansTable, mealPlanDaysTable, mealEntriesTable, recipesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const GERMAN_DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

interface TodayMealEntry {
  mealType: string;
  recipeName: string | null;
  cookTime: number | null;
  prepTime: number | null;
  customNote: string | null;
  recipeId: number | null;
  energyType: string | null;
}

router.get("/today", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const dayName = GERMAN_DAYS[now.getDay()];

    const [activePlan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)));

    if (!activePlan) {
      res.json({
        date: dateStr,
        dayName,
        planTitle: null,
        meals: [] as TodayMealEntry[],
        hasPlan: false,
      });
      return;
    }

    const startDate = new Date(activePlan.createdAt);
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleLength = activePlan.cycleLengthDays;
    const dayNumber = activePlan.repeatEnabled
      ? (diffDays % cycleLength) + 1
      : Math.min(diffDays + 1, cycleLength);

    const [day] = await db
      .select()
      .from(mealPlanDaysTable)
      .where(and(
        eq(mealPlanDaysTable.mealPlanId, activePlan.id),
        eq(mealPlanDaysTable.dayNumber, dayNumber)
      ));

    if (!day) {
      res.json({
        date: dateStr,
        dayName,
        planTitle: activePlan.title,
        meals: [] as TodayMealEntry[],
        hasPlan: true,
      });
      return;
    }

    const entries = await db
      .select({
        id: mealEntriesTable.id,
        mealType: mealEntriesTable.mealType,
        recipeId: mealEntriesTable.recipeId,
        customNote: mealEntriesTable.customNote,
        recipeTitle: recipesTable.title,
        recipeCookTime: recipesTable.cookTime,
        recipePrepTime: recipesTable.prepTime,
        recipeEnergyType: recipesTable.energyType,
      })
      .from(mealEntriesTable)
      .leftJoin(recipesTable, eq(mealEntriesTable.recipeId, recipesTable.id))
      .where(eq(mealEntriesTable.mealPlanDayId, day.id));

    const mealOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
    const sortedEntries = entries.sort((a, b) => (mealOrder[a.mealType] ?? 99) - (mealOrder[b.mealType] ?? 99));

    res.json({
      date: dateStr,
      dayName,
      planTitle: activePlan.title,
      meals: sortedEntries.map((e): TodayMealEntry => ({
        mealType: e.mealType,
        recipeName: e.recipeTitle ?? null,
        cookTime: e.recipeCookTime ?? null,
        prepTime: e.recipePrepTime ?? null,
        customNote: e.customNote,
        recipeId: e.recipeId,
        energyType: e.recipeEnergyType ?? null,
      })),
      hasPlan: true,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get today's meals");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
