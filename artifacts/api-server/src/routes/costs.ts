import { Router } from "express";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
  shoppingListsTable,
  shoppingListItemsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const UNIT_CONVERSIONS: Record<string, { toBase: number; baseUnit: string }> = {
  kg: { toBase: 1000, baseUnit: "g" },
  g: { toBase: 1, baseUnit: "g" },
  l: { toBase: 1000, baseUnit: "ml" },
  ml: { toBase: 1, baseUnit: "ml" },
  el: { toBase: 15, baseUnit: "ml" },
  tl: { toBase: 5, baseUnit: "ml" },
  stück: { toBase: 1, baseUnit: "stück" },
  zehe: { toBase: 1, baseUnit: "stück" },
};

function parseAmount(amount: string): number {
  const n = parseFloat(amount.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function getPricePerUnit(priceValue: string | null, priceUnit: string | null): { price: number; unit: string; quantity: number } | null {
  if (!priceValue || !priceUnit) return null;
  const price = parseFloat(priceValue);
  if (isNaN(price)) return null;

  const pu = priceUnit.toLowerCase();
  if (pu.includes("kg")) return { price, unit: "g", quantity: 1000 };
  if (pu.includes("l") && !pu.includes("stück")) return { price, unit: "ml", quantity: 1000 };
  if (pu.includes("stück")) return { price, unit: "stück", quantity: 1 };
  return { price, unit: "stück", quantity: 1 };
}

function calculateIngredientCost(
  amount: number,
  unit: string,
  priceMin: string | null,
  priceMax: string | null,
  priceAvg: string | null,
  priceUnit: string | null,
): { min: number; max: number; avg: number } | null {
  const pMin = getPricePerUnit(priceMin, priceUnit);
  const pMax = getPricePerUnit(priceMax, priceUnit);
  const pAvg = getPricePerUnit(priceAvg, priceUnit);
  if (!pMin || !pMax || !pAvg) return null;

  const unitLower = unit.toLowerCase();
  const conversion = UNIT_CONVERSIONS[unitLower];
  let normalizedAmount: number;
  let normalizedUnit: string;

  if (conversion) {
    normalizedAmount = amount * conversion.toBase;
    normalizedUnit = conversion.baseUnit;
  } else {
    normalizedAmount = amount;
    normalizedUnit = "stück";
  }

  if (normalizedUnit !== pMin.unit) {
    return null;
  }

  const factor = normalizedAmount / pMin.quantity;
  return {
    min: pMin.price * factor,
    max: pMax.price * factor,
    avg: pAvg.price * factor,
  };
}

export async function calculateRecipeCostInternal(recipeId: number, servings?: number): Promise<{ min: number; max: number; avg: number; perServing: { min: number; max: number; avg: number } } | null> {
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId));
  if (!recipe) return null;

  const recipeIngredients = await db
    .select({
      amount: recipeIngredientsTable.amount,
      unit: recipeIngredientsTable.unit,
      ingredientId: recipeIngredientsTable.ingredientId,
      priceMin: ingredientsTable.priceMin,
      priceMax: ingredientsTable.priceMax,
      priceAvg: ingredientsTable.priceAvg,
      priceUnit: ingredientsTable.priceUnit,
    })
    .from(recipeIngredientsTable)
    .leftJoin(ingredientsTable, eq(recipeIngredientsTable.ingredientId, ingredientsTable.id))
    .where(eq(recipeIngredientsTable.recipeId, recipeId));

  let totalMin = 0;
  let totalMax = 0;
  let totalAvg = 0;

  for (const ing of recipeIngredients) {
    const amount = parseAmount(ing.amount);
    const cost = calculateIngredientCost(amount, ing.unit, ing.priceMin, ing.priceMax, ing.priceAvg, ing.priceUnit);
    if (cost) {
      totalMin += cost.min;
      totalMax += cost.max;
      totalAvg += cost.avg;
    }
  }

  const actualServings = servings ?? recipe.servings;
  const scaleFactor = actualServings / recipe.servings;

  const scaledMin = totalMin * scaleFactor;
  const scaledMax = totalMax * scaleFactor;
  const scaledAvg = totalAvg * scaleFactor;

  return {
    min: Math.round(scaledMin * 100) / 100,
    max: Math.round(scaledMax * 100) / 100,
    avg: Math.round(scaledAvg * 100) / 100,
    perServing: {
      min: Math.round((scaledMin / actualServings) * 100) / 100,
      max: Math.round((scaledMax / actualServings) * 100) / 100,
      avg: Math.round((scaledAvg / actualServings) * 100) / 100,
    },
  };
}

export async function calculateWeekCostInternal(shoppingListId: number): Promise<{ min: number; max: number; avg: number } | null> {
  const [list] = await db.select().from(shoppingListsTable).where(eq(shoppingListsTable.id, shoppingListId));
  if (!list) return null;

  const items = await db
    .select({
      name: shoppingListItemsTable.name,
      amount: shoppingListItemsTable.amount,
      unit: shoppingListItemsTable.unit,
      ingredientId: shoppingListItemsTable.ingredientId,
      priceMin: ingredientsTable.priceMin,
      priceMax: ingredientsTable.priceMax,
      priceAvg: ingredientsTable.priceAvg,
      priceUnit: ingredientsTable.priceUnit,
    })
    .from(shoppingListItemsTable)
    .leftJoin(ingredientsTable, eq(shoppingListItemsTable.ingredientId, ingredientsTable.id))
    .where(eq(shoppingListItemsTable.shoppingListId, shoppingListId));

  let totalMin = 0;
  let totalMax = 0;
  let totalAvg = 0;

  for (const item of items) {
    const amount = item.amount ? parseAmount(item.amount) : 1;
    const unit = item.unit ?? "Stück";
    const cost = calculateIngredientCost(amount, unit, item.priceMin, item.priceMax, item.priceAvg, item.priceUnit);
    if (cost) {
      totalMin += cost.min;
      totalMax += cost.max;
      totalAvg += cost.avg;
    }
  }

  return {
    min: Math.round(totalMin * 100) / 100,
    max: Math.round(totalMax * 100) / 100,
    avg: Math.round(totalAvg * 100) / 100,
  };
}

router.get("/costs/recipe/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const recipeId = parseInt(req.params["id"] as string);
    if (isNaN(recipeId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId));
    if (!recipe) { res.status(404).json({ error: "Rezept nicht gefunden" }); return; }
    if (!recipe.isPublic && recipe.userId !== userId) {
      res.status(403).json({ error: "Kein Zugriff auf dieses Rezept" });
      return;
    }

    const servingsParam = req.query["servings"];
    const servings = servingsParam ? parseInt(servingsParam as string) : undefined;
    if (servings !== undefined && (isNaN(servings) || servings < 1)) {
      res.status(400).json({ error: "Ungültige Portionenanzahl" });
      return;
    }

    const cost = await calculateRecipeCostInternal(recipeId, servings);
    if (!cost) { res.status(404).json({ error: "Rezept nicht gefunden" }); return; }

    res.json(cost);
  } catch (err) {
    req.log.error({ err }, "Failed to calculate recipe cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/costs/shopping-list/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    if (isNaN(listId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden" }); return; }

    const cost = await calculateWeekCostInternal(listId);
    if (!cost) { res.status(404).json({ error: "Kosten konnten nicht berechnet werden" }); return; }

    res.json(cost);
  } catch (err) {
    req.log.error({ err }, "Failed to calculate shopping list cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/costs/today", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { mealPlansTable, mealPlanDaysTable, mealEntriesTable } = await import("@workspace/db");

    const [activePlan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)));

    if (!activePlan) {
      res.json({ min: 0, max: 0, avg: 0, meals: [] });
      return;
    }

    const now = new Date();
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
      res.json({ min: 0, max: 0, avg: 0, meals: [] });
      return;
    }

    const entries = await db
      .select({
        id: mealEntriesTable.id,
        mealType: mealEntriesTable.mealType,
        recipeId: mealEntriesTable.recipeId,
        recipeTitle: recipesTable.title,
        recipeServings: recipesTable.servings,
      })
      .from(mealEntriesTable)
      .leftJoin(recipesTable, eq(mealEntriesTable.recipeId, recipesTable.id))
      .where(eq(mealEntriesTable.mealPlanDayId, day.id));

    let totalMin = 0;
    let totalMax = 0;
    let totalAvg = 0;
    const mealCosts: { mealType: string; recipeTitle: string | null; cost: { min: number; max: number; avg: number } | null }[] = [];

    for (const entry of entries) {
      if (entry.recipeId) {
        const cost = await calculateRecipeCostInternal(entry.recipeId);
        if (cost) {
          totalMin += cost.perServing.min;
          totalMax += cost.perServing.max;
          totalAvg += cost.perServing.avg;
        }
        mealCosts.push({
          mealType: entry.mealType,
          recipeTitle: entry.recipeTitle,
          cost: cost ? cost.perServing : null,
        });
      } else {
        mealCosts.push({ mealType: entry.mealType, recipeTitle: null, cost: null });
      }
    }

    res.json({
      min: Math.round(totalMin * 100) / 100,
      max: Math.round(totalMax * 100) / 100,
      avg: Math.round(totalAvg * 100) / 100,
      meals: mealCosts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to calculate today's cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
