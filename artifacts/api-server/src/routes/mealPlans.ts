import { Router } from "express";
import { db } from "@workspace/db";
import {
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import type { MealPlan } from "@workspace/db";

const router = Router();

interface MealEntryRow {
  id: number;
  mealPlanDayId: number;
  mealType: string;
  recipeId: number | null;
  customNote: string | null;
  timeSlot: string | null;
  recipe: {
    id: number;
    userId: string | null;
    title: string;
    description: string | null;
    prepTime: number;
    cookTime: number;
    servings: number;
    instructions: string;
    tags: string[];
    aiGenerated: boolean;
    energyType: string;
    isPublic: boolean;
    createdAt: string;
    ingredients: never[];
  } | null;
}

interface MealPlanDayRow {
  id: number;
  mealPlanId: number;
  dayNumber: number;
  entries: MealEntryRow[];
}

interface MealPlanDetail extends MealPlan {
  days: MealPlanDayRow[];
}

async function getMealPlanWithDays(planId: number): Promise<MealPlanDetail | null> {
  const [plan] = await db.select().from(mealPlansTable).where(eq(mealPlansTable.id, planId));
  if (!plan) return null;

  const days = await db.select().from(mealPlanDaysTable).where(eq(mealPlanDaysTable.mealPlanId, planId));

  const daysWithEntries: MealPlanDayRow[] = await Promise.all(
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
        entries: entries.map((e): MealEntryRow => ({
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
            prepTime: e.recipePrepTime!,
            cookTime: e.recipeCookTime!,
            servings: e.recipeServings!,
            instructions: e.recipeInstructions ?? "",
            tags: e.recipeTags ?? [],
            aiGenerated: e.recipeAiGenerated!,
            energyType: e.recipeEnergyType!,
            isPublic: e.recipeIsPublic!,
            createdAt: e.recipeCreatedAt instanceof Date ? e.recipeCreatedAt.toISOString() : String(e.recipeCreatedAt),
            ingredients: [],
          } : null,
        })),
      };
    })
  );

  return {
    ...plan,
    days: daysWithEntries.sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

function formatPlan(plan: MealPlan) {
  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.title,
    cycleLengthDays: plan.cycleLengthDays,
    repeatEnabled: plan.repeatEnabled,
    active: plan.active,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
  };
}

router.get("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const plans = await db.select().from(mealPlansTable).where(eq(mealPlansTable.userId, userId));
    res.json(plans.map(formatPlan));
  } catch (err) {
    req.log.error({ err }, "Failed to list meal plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

interface CreateMealPlanBody {
  title: string;
  cycleLengthDays?: number;
  repeatEnabled?: boolean;
}

router.post("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title, cycleLengthDays, repeatEnabled } = req.body as CreateMealPlanBody;

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

    res.status(201).json(formatPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Failed to create meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/meal-plans/active", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
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

router.post("/meal-plans/starter", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const existingActive = await db
      .select({ id: mealPlansTable.id })
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)));

    if (existingActive.length > 0) {
      const detail = await getMealPlanWithDays(existingActive[0].id);
      res.json(detail);
      return;
    }

    const publicRecipes = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(eq(recipesTable.isPublic, true))
      .limit(3);

    const [plan] = await db
      .insert(mealPlansTable)
      .values({
        userId,
        title: "Mein erster Wochenplan",
        cycleLengthDays: 7,
        repeatEnabled: true,
        active: true,
      })
      .returning();

    const [day] = await db
      .insert(mealPlanDaysTable)
      .values({ mealPlanId: plan.id, dayNumber: 1 })
      .returning();

    const mealTypes = ["breakfast", "lunch", "dinner"] as const;
    const entries = publicRecipes.slice(0, 3).map((recipe, i) => ({
      mealPlanDayId: day.id,
      mealType: mealTypes[i],
      recipeId: recipe.id,
    }));

    if (entries.length > 0) {
      await db.insert(mealEntriesTable).values(entries);
    }

    const detail = await getMealPlanWithDays(plan.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to create starter meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
