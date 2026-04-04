import { Router } from "express";
import { db } from "@workspace/db";
import { mealPlansTable, mealPlanDaysTable, mealEntriesTable, recipesTable, fridgeItemsTable, ingredientsTable } from "@workspace/db";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const GERMAN_DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

interface TodayMealEntry {
  id: number;
  mealType: string;
  recipeName: string | null;
  cookTime: number | null;
  prepTime: number | null;
  customNote: string | null;
  recipeId: number | null;
  energyType: string | null;
  overrideCookTime: number | null;
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
      const twoDaysFromNow2 = new Date();
      twoDaysFromNow2.setDate(twoDaysFromNow2.getDate() + 2);
      const earlyExpiring = await db
        .select({
          id: fridgeItemsTable.id,
          ingredientName: ingredientsTable.name,
          bestBeforeDate: fridgeItemsTable.bestBeforeDate,
          ingredientId: fridgeItemsTable.ingredientId,
        })
        .from(fridgeItemsTable)
        .innerJoin(ingredientsTable, eq(fridgeItemsTable.ingredientId, ingredientsTable.id))
        .where(and(
          eq(fridgeItemsTable.userId, userId),
          inArray(fridgeItemsTable.status, ["likely_available", "maybe_low"]),
          gte(fridgeItemsTable.bestBeforeDate, dateStr),
          lte(fridgeItemsTable.bestBeforeDate, twoDaysFromNow2.toISOString().split("T")[0]!)
        ));

      res.json({
        date: dateStr,
        dayName,
        planTitle: null,
        meals: [] as TodayMealEntry[],
        hasPlan: false,
        expiringItems: earlyExpiring,
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
        overrideCookTime: mealEntriesTable.overrideCookTime,
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

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const todayDate2 = now.toISOString().split("T")[0]!;
    const twoStr = twoDaysFromNow.toISOString().split("T")[0]!;

    const expiringRows = await db
      .select({
        id: fridgeItemsTable.id,
        ingredientName: ingredientsTable.name,
        bestBeforeDate: fridgeItemsTable.bestBeforeDate,
        ingredientId: fridgeItemsTable.ingredientId,
      })
      .from(fridgeItemsTable)
      .innerJoin(ingredientsTable, eq(fridgeItemsTable.ingredientId, ingredientsTable.id))
      .where(and(
        eq(fridgeItemsTable.userId, userId),
        inArray(fridgeItemsTable.status, ["likely_available", "maybe_low"]),
        gte(fridgeItemsTable.bestBeforeDate, todayDate2),
        lte(fridgeItemsTable.bestBeforeDate, twoStr)
      ));

    res.json({
      date: dateStr,
      dayName,
      planTitle: activePlan.title,
      meals: sortedEntries.map((e): TodayMealEntry => ({
        id: e.id,
        mealType: e.mealType,
        recipeName: e.recipeTitle ?? null,
        cookTime: e.recipeCookTime ?? null,
        prepTime: e.recipePrepTime ?? null,
        customNote: e.customNote,
        recipeId: e.recipeId,
        energyType: e.recipeEnergyType ?? null,
        overrideCookTime: e.overrideCookTime,
      })),
      hasPlan: true,
      expiringItems: expiringRows,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get today's meals");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
