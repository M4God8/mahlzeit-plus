import { Router } from "express";
import { db } from "@workspace/db";
import {
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function getMealPlanWithDays(planId: number) {
  const [plan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, planId));
  if (!plan) return null;

  const days = await db.select().from(mealPlanDaysTable).where(eq(mealPlanDaysTable.mealPlanId, planId));

  const daysWithEntries = await Promise.all(
    days.map(async (day) => {
      const entries = await db
        .select({
          id: mealEntriesTable.id,
          mealPlanDayId: mealEntriesTable.mealPlanDayId,
          mealType: mealEntriesTable.mealType,
          recipeId: mealEntriesTable.recipeId,
          customNote: mealEntriesTable.customNote,
          timeSlot: mealEntriesTable.timeSlot,
          recipeTitle: recipesTable.title,
          recipePrepTime: recipesTable.prepTime,
          recipeCookTime: recipesTable.cookTime,
          recipeServings: recipesTable.servings,
          recipeInstructions: recipesTable.instructions,
          recipeTags: recipesTable.tags,
          recipeAiGenerated: recipesTable.aiGenerated,
          recipeEnergyType: recipesTable.energyType,
          recipeIsPublic: recipesTable.isPublic,
          recipeCreatedAt: recipesTable.createdAt,
          recipeUserId: recipesTable.userId,
          recipeDescription: recipesTable.description,
        })
        .from(mealEntriesTable)
        .leftJoin(recipesTable, eq(mealEntriesTable.recipeId, recipesTable.id))
        .where(eq(mealEntriesTable.mealPlanDayId, day.id));

      return {
        id: day.id,
        mealPlanId: day.mealPlanId,
        dayNumber: day.dayNumber,
        entries: entries.map(e => ({
          id: e.id,
          mealPlanDayId: e.mealPlanDayId,
          mealType: e.mealType,
          recipeId: e.recipeId,
          customNote: e.customNote,
          timeSlot: e.timeSlot ? String(e.timeSlot) : null,
          recipe: e.recipeTitle ? {
            id: e.recipeId!,
            userId: e.recipeUserId,
            title: e.recipeTitle,
            description: e.recipeDescription,
            prepTime: e.recipePrepTime,
            cookTime: e.recipeCookTime,
            servings: e.recipeServings,
            instructions: e.recipeInstructions ?? "",
            tags: e.recipeTags ?? [],
            aiGenerated: e.recipeAiGenerated,
            energyType: e.recipeEnergyType,
            isPublic: e.recipeIsPublic,
            createdAt: e.recipeCreatedAt?.toISOString?.() ?? e.recipeCreatedAt,
            ingredients: [],
          } : null,
        })),
      };
    })
  );

  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.title,
    cycleLengthDays: plan.cycleLengthDays,
    repeatEnabled: plan.repeatEnabled,
    active: plan.active,
    createdAt: plan.createdAt?.toISOString?.() ?? plan.createdAt,
    days: daysWithEntries.sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

router.get("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const plans = await db.select().from(mealPlansTable).where(eq(mealPlansTable.userId, userId));
    res.json(plans.map(p => ({
      id: p.id,
      userId: p.userId,
      title: p.title,
      cycleLengthDays: p.cycleLengthDays,
      repeatEnabled: p.repeatEnabled,
      active: p.active,
      createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list meal plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const { title, cycleLengthDays, repeatEnabled } = req.body;

    const [plan] = await db
      .insert(mealPlansTable)
      .values({
        userId,
        title,
        cycleLengthDays: cycleLengthDays ?? 7,
        repeatEnabled: repeatEnabled ?? false,
        active: false,
      })
      .returning();

    res.status(201).json({
      id: plan.id,
      userId: plan.userId,
      title: plan.title,
      cycleLengthDays: plan.cycleLengthDays,
      repeatEnabled: plan.repeatEnabled,
      active: plan.active,
      createdAt: plan.createdAt?.toISOString?.() ?? plan.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/meal-plans/active", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const [plan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)));

    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }

    const detail = await getMealPlanWithDays(plan.id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get active meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
