import { Router } from "express";
import { db } from "@workspace/db";
import {
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
  fridgeItemsTable,
} from "@workspace/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { calculateRecipeCostInternal } from "./costs";

const router = Router();

interface MealTypeCount {
  type: string;
  count: number;
}

interface TopRecipe {
  id: number;
  title: string;
  count: number;
}

interface CategoryDistribution {
  category: string;
  count: number;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseAndValidateMonth(monthStr: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) return null;
  const [yearStr, monthStr2] = monthStr.split("-");
  const year = parseInt(yearStr!);
  const month = parseInt(monthStr2!);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

async function aggregateMonthMeals(
  userPlans: (typeof mealPlansTable.$inferSelect)[],
  year: number,
  month: number,
) {
  const daysInMonth = getDaysInMonth(year, month);
  const mealTypeCounts: Record<string, number> = {};
  const recipeUsage: Record<number, { title: string; count: number }> = {};
  const recipeIdsUsed = new Set<number>();
  let totalMeals = 0;
  let daysWithMeals = 0;

  const dayPlanMap: { dayNumber: number; planId: number }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);

    let activePlan = null;
    for (const plan of userPlans) {
      const planCreated = new Date(plan.createdAt);
      if (planCreated <= dateObj) {
        if (!activePlan || planCreated > new Date(activePlan.createdAt)) {
          activePlan = plan;
        }
      }
    }

    if (!activePlan) continue;

    const startDate = new Date(activePlan.createdAt);
    const diffDays = Math.floor((dateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) continue;

    const cycleLength = activePlan.cycleLengthDays;
    const dayNumber = activePlan.repeatEnabled
      ? (diffDays % cycleLength) + 1
      : Math.min(diffDays + 1, cycleLength);

    dayPlanMap.push({ dayNumber, planId: activePlan.id });
  }

  const uniquePlanDays = new Map<string, { dayNumber: number; planId: number }>();
  for (const dp of dayPlanMap) {
    uniquePlanDays.set(`${dp.planId}-${dp.dayNumber}`, dp);
  }

  const planIds = [...new Set(dayPlanMap.map((dp) => dp.planId))];
  if (planIds.length === 0) {
    return { mealTypeCounts, recipeUsage, recipeIdsUsed, totalMeals, daysWithMeals };
  }

  const allDays = await db
    .select()
    .from(mealPlanDaysTable)
    .where(inArray(mealPlanDaysTable.mealPlanId, planIds));

  const dayIdToPlanDay = new Map<number, { planId: number; dayNumber: number }>();
  const relevantDayIds: number[] = [];
  for (const day of allDays) {
    const key = `${day.mealPlanId}-${day.dayNumber}`;
    if (uniquePlanDays.has(key)) {
      dayIdToPlanDay.set(day.id, { planId: day.mealPlanId, dayNumber: day.dayNumber });
      relevantDayIds.push(day.id);
    }
  }

  if (relevantDayIds.length === 0) {
    return { mealTypeCounts, recipeUsage, recipeIdsUsed, totalMeals, daysWithMeals };
  }

  const allEntries = await db
    .select({
      id: mealEntriesTable.id,
      mealType: mealEntriesTable.mealType,
      recipeId: mealEntriesTable.recipeId,
      recipeTitle: recipesTable.title,
      mealPlanDayId: mealEntriesTable.mealPlanDayId,
    })
    .from(mealEntriesTable)
    .leftJoin(recipesTable, eq(mealEntriesTable.recipeId, recipesTable.id))
    .where(inArray(mealEntriesTable.mealPlanDayId, relevantDayIds));

  const entriesByDayId = new Map<number, typeof allEntries>();
  for (const entry of allEntries) {
    const dayId = entry.mealPlanDayId;
    if (!entriesByDayId.has(dayId)) entriesByDayId.set(dayId, []);
    entriesByDayId.get(dayId)!.push(entry);
  }

  for (let calendarDay = 0; calendarDay < dayPlanMap.length; calendarDay++) {
    const dp = dayPlanMap[calendarDay]!;
    const matchingDay = allDays.find(
      (d) => d.mealPlanId === dp.planId && d.dayNumber === dp.dayNumber,
    );
    if (!matchingDay) continue;

    const entries = entriesByDayId.get(matchingDay.id) || [];
    if (entries.length > 0) {
      daysWithMeals++;
    }

    for (const entry of entries) {
      totalMeals++;
      mealTypeCounts[entry.mealType] = (mealTypeCounts[entry.mealType] || 0) + 1;

      if (entry.recipeId && entry.recipeTitle) {
        recipeIdsUsed.add(entry.recipeId);
        if (!recipeUsage[entry.recipeId]) {
          recipeUsage[entry.recipeId] = { title: entry.recipeTitle, count: 0 };
        }
        recipeUsage[entry.recipeId]!.count++;
      }
    }
  }

  return { mealTypeCounts, recipeUsage, recipeIdsUsed, totalMeals, daysWithMeals };
}

router.get("/review/monthly", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const monthParam = req.query["month"] as string | undefined;
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthStr = monthParam || defaultMonth;

    const parsed = parseAndValidateMonth(monthStr);
    if (!parsed) {
      res.status(400).json({ error: "Ungültiges Monatsformat. Erwartet: YYYY-MM (Monat 01-12)" });
      return;
    }

    const { year, month } = parsed;
    const daysInMonth = getDaysInMonth(year, month);

    const userPlans = await db
      .select()
      .from(mealPlansTable)
      .where(eq(mealPlansTable.userId, userId));

    const {
      mealTypeCounts,
      recipeUsage,
      recipeIdsUsed,
      totalMeals,
      daysWithMeals,
    } = await aggregateMonthMeals(userPlans, year, month);

    const byType: MealTypeCount[] = Object.entries(mealTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const topRecipes: TopRecipe[] = Object.entries(recipeUsage)
      .map(([id, data]) => ({ id: parseInt(id), title: data.title, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const allRecipeIds = Array.from(recipeIdsUsed);
    const recipeCostCache = new Map<number, { min: number; max: number; avg: number }>();
    for (const recipeId of allRecipeIds) {
      const cost = await calculateRecipeCostInternal(recipeId);
      if (cost) {
        recipeCostCache.set(recipeId, cost.perServing);
      }
    }

    let totalCostMin = 0;
    let totalCostMax = 0;
    let totalCostAvg = 0;
    for (const [idStr, usage] of Object.entries(recipeUsage)) {
      const cost = recipeCostCache.get(parseInt(idStr));
      if (cost) {
        totalCostMin += cost.min * usage.count;
        totalCostMax += cost.max * usage.count;
        totalCostAvg += cost.avg * usage.count;
      }
    }

    const perDayAvg = daysWithMeals > 0 ? totalCostAvg / daysWithMeals : 0;
    const perWeekAvg = perDayAvg * 7;

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevAgg = await aggregateMonthMeals(userPlans, prevYear, prevMonth);

    let previousMonthCost: { totalAvg: number } | null = null;
    if (prevAgg.totalMeals > 0) {
      let prevTotalAvg = 0;
      for (const [idStr, usage] of Object.entries(prevAgg.recipeUsage)) {
        const recipeId = parseInt(idStr);
        let cost = recipeCostCache.get(recipeId);
        if (!cost) {
          const c = await calculateRecipeCostInternal(recipeId);
          if (c) {
            cost = c.perServing;
            recipeCostCache.set(recipeId, cost);
          }
        }
        if (cost) {
          prevTotalAvg += cost.avg * usage.count;
        }
      }
      previousMonthCost = { totalAvg: Math.round(prevTotalAvg * 100) / 100 };
    }

    const categoryDistribution: Record<string, number> = {};
    if (allRecipeIds.length > 0) {
      const ingredientRows = await db
        .select({
          category: ingredientsTable.category,
          recipeId: recipeIngredientsTable.recipeId,
        })
        .from(recipeIngredientsTable)
        .innerJoin(ingredientsTable, eq(recipeIngredientsTable.ingredientId, ingredientsTable.id))
        .where(inArray(recipeIngredientsTable.recipeId, allRecipeIds));

      for (const row of ingredientRows) {
        const freq = recipeUsage[row.recipeId]?.count ?? 1;
        categoryDistribution[row.category] = (categoryDistribution[row.category] || 0) + freq;
      }
    }

    const nutritionBalance: CategoryDistribution[] = Object.entries(categoryDistribution)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const usedIngredientIds = new Set<number>();
    if (allRecipeIds.length > 0) {
      const recipeIngRows = await db
        .select({ ingredientId: recipeIngredientsTable.ingredientId })
        .from(recipeIngredientsTable)
        .where(inArray(recipeIngredientsTable.recipeId, allRecipeIds));
      for (const row of recipeIngRows) {
        if (row.ingredientId) usedIngredientIds.add(row.ingredientId);
      }
    }

    const fridgeItems = await db
      .select({
        id: fridgeItemsTable.id,
        ingredientId: fridgeItemsTable.ingredientId,
        status: fridgeItemsTable.status,
        bestBeforeDate: fridgeItemsTable.bestBeforeDate,
        lastSeenAt: fridgeItemsTable.lastSeenAt,
      })
      .from(fridgeItemsTable)
      .where(
        and(
          eq(fridgeItemsTable.userId, userId),
          gte(fridgeItemsTable.bestBeforeDate, monthStart),
          lte(fridgeItemsTable.bestBeforeDate, monthEnd)
        )
      );

    let itemsUsedBeforeExpiry = 0;
    let itemsExpired = 0;

    for (const item of fridgeItems) {
      if (!item.bestBeforeDate) continue;
      const bestBefore = new Date(item.bestBeforeDate);

      if (item.status === "likely_gone") {
        const lastSeen = new Date(item.lastSeenAt);
        if (lastSeen <= bestBefore && usedIngredientIds.has(item.ingredientId)) {
          itemsUsedBeforeExpiry++;
        } else {
          itemsExpired++;
        }
      }
    }

    const totalTracked = itemsUsedBeforeExpiry + itemsExpired;
    const wastePreventionRate = totalTracked > 0
      ? Math.round((itemsUsedBeforeExpiry / totalTracked) * 100)
      : 100;

    const uniqueRecipes = allRecipeIds.length;
    const mealTypeVariety = Object.keys(mealTypeCounts).length;

    const regularityScore = totalMeals > 0
      ? Math.min(100, Math.round((daysWithMeals / daysInMonth) * 100))
      : 0;

    const varietyScore = Math.min(100, Math.round(
      (uniqueRecipes >= 10 ? 50 : uniqueRecipes * 5) +
      (mealTypeVariety >= 4 ? 50 : mealTypeVariety * 12.5)
    ));

    const costEfficiencyScore = perDayAvg > 0
      ? Math.min(100, Math.max(0, Math.round(100 - (perDayAvg / 20) * 100 + 50)))
      : 50;

    const wasteAvoidanceScore = wastePreventionRate;

    const score = Math.round(
      regularityScore * 0.3 +
      varietyScore * 0.25 +
      costEfficiencyScore * 0.2 +
      wasteAvoidanceScore * 0.25
    );

    res.json({
      month: monthStr,
      mealDistribution: {
        total: totalMeals,
        byType,
        topRecipes,
      },
      costs: {
        totalMin: Math.round(totalCostMin * 100) / 100,
        totalMax: Math.round(totalCostMax * 100) / 100,
        totalAvg: Math.round(totalCostAvg * 100) / 100,
        perDayAvg: Math.round(perDayAvg * 100) / 100,
        perWeekAvg: Math.round(perWeekAvg * 100) / 100,
        previousMonth: previousMonthCost,
      },
      nutritionBalance,
      foodWaste: {
        itemsUsedBeforeExpiry,
        itemsExpired,
        wastePreventionRate,
      },
      score,
      scoreBreakdown: {
        regularity: regularityScore,
        variety: varietyScore,
        costEfficiency: costEfficiencyScore,
        wasteAvoidance: wasteAvoidanceScore,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get monthly review");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
