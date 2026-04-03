import { Router } from "express";
import { db } from "@workspace/db";
import {
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
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

const createMealPlanSchema = z.object({
  title: z.string().min(1).max(200),
  cycleLengthDays: z.number().int().min(1).max(30),
  repeatEnabled: z.boolean(),
});

router.post("/meal-plans", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = createMealPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
      return;
    }
    const userId = req.userId!;
    const { title, cycleLengthDays, repeatEnabled } = parsed.data;

    const [plan] = await db
      .insert(mealPlansTable)
      .values({ userId, title, cycleLengthDays, repeatEnabled, active: false })
      .returning();

    const days: typeof mealPlanDaysTable.$inferInsert[] = [];
    for (let i = 1; i <= cycleLengthDays; i++) {
      days.push({ mealPlanId: plan.id, dayNumber: i });
    }
    await db.insert(mealPlanDaysTable).values(days);

    res.status(201).json({
      id: plan.id,
      userId: plan.userId,
      title: plan.title,
      cycleLengthDays: plan.cycleLengthDays,
      repeatEnabled: plan.repeatEnabled,
      active: plan.active,
      createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : String(plan.createdAt),
    });
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

    const dayRows: typeof mealPlanDaysTable.$inferInsert[] = [];
    for (let i = 1; i <= 7; i++) {
      dayRows.push({ mealPlanId: plan.id, dayNumber: i });
    }
    const insertedDays = await db.insert(mealPlanDaysTable).values(dayRows).returning();

    const day1 = insertedDays.find(d => d.dayNumber === 1);
    if (day1 && publicRecipes.length > 0) {
      const mealTypes = ["breakfast", "lunch", "dinner"] as const;
      const entries = publicRecipes.slice(0, 3).map((recipe, i) => ({
        mealPlanDayId: day1.id,
        mealType: mealTypes[i],
        recipeId: recipe.id,
      }));
      await db.insert(mealEntriesTable).values(entries);
    }

    const detail = await getMealPlanWithDays(plan.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to create starter meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    const detail = await getMealPlanWithDays(planId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

const updateMealPlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  repeatEnabled: z.boolean().optional(),
});

router.patch("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const parsed = updateMealPlanSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    const updates: Partial<typeof mealPlansTable.$inferInsert> = {};
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.repeatEnabled !== undefined) updates.repeatEnabled = parsed.data.repeatEnabled;

    const [updated] = await db.update(mealPlansTable).set(updates).where(eq(mealPlansTable.id, planId)).returning();
    res.json(formatPlan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/meal-plans/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    await db.delete(mealPlansTable).where(eq(mealPlansTable.id, planId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/meal-plans/:id/activate", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    await db.update(mealPlansTable).set({ active: false }).where(eq(mealPlansTable.userId, userId));
    const [updated] = await db.update(mealPlansTable).set({ active: true }).where(eq(mealPlansTable.id, planId)).returning();
    res.json(formatPlan(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to activate meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

const copyMealPlanSchema = z.object({
  setActive: z.boolean().optional(),
});

router.post("/meal-plans/:id/copy", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const parsed = copyMealPlanSchema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe" }); return; }

    const [original] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!original) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    const setActive = parsed.data.setActive ?? false;
    if (setActive) {
      await db.update(mealPlansTable).set({ active: false }).where(eq(mealPlansTable.userId, userId));
    }

    const [newPlan] = await db
      .insert(mealPlansTable)
      .values({
        userId,
        title: `${original.title} (Kopie)`,
        cycleLengthDays: original.cycleLengthDays,
        repeatEnabled: original.repeatEnabled,
        active: setActive,
      })
      .returning();

    const originalDays = await db.select().from(mealPlanDaysTable).where(eq(mealPlanDaysTable.mealPlanId, planId));
    for (const day of originalDays) {
      const [newDay] = await db.insert(mealPlanDaysTable).values({ mealPlanId: newPlan.id, dayNumber: day.dayNumber }).returning();
      const originalEntries = await db.select().from(mealEntriesTable).where(eq(mealEntriesTable.mealPlanDayId, day.id));
      if (originalEntries.length > 0) {
        await db.insert(mealEntriesTable).values(
          originalEntries.map(e => ({
            mealPlanDayId: newDay.id,
            mealType: e.mealType,
            recipeId: e.recipeId,
            customNote: e.customNote,
          }))
        );
      }
    }

    const detail = await getMealPlanWithDays(newPlan.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to copy meal plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

const swapDaysSchema = z.object({
  dayNumberA: z.number().int().min(1),
  dayNumberB: z.number().int().min(1),
});

router.post("/meal-plans/:id/swap-days", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const parsed = swapDaysSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    const { dayNumberA, dayNumberB } = parsed.data;
    const days = await db.select().from(mealPlanDaysTable).where(eq(mealPlanDaysTable.mealPlanId, planId));

    const dayA = days.find(d => d.dayNumber === dayNumberA);
    const dayB = days.find(d => d.dayNumber === dayNumberB);

    if (!dayA || !dayB) { res.status(404).json({ error: "Tage nicht gefunden" }); return; }

    const TEMP = -999;
    await db.update(mealPlanDaysTable).set({ dayNumber: TEMP }).where(eq(mealPlanDaysTable.id, dayA.id));
    await db.update(mealPlanDaysTable).set({ dayNumber: dayNumberA }).where(eq(mealPlanDaysTable.id, dayB.id));
    await db.update(mealPlanDaysTable).set({ dayNumber: dayNumberB }).where(eq(mealPlanDaysTable.id, dayA.id));

    const detail = await getMealPlanWithDays(planId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to swap days");
    res.status(500).json({ error: "Internal server error" });
  }
});

const addDaySchema = z.object({
  dayNumber: z.number().int().min(1),
});

router.post("/meal-plans/:id/days", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    if (isNaN(planId)) { res.status(400).json({ error: "Ungültige Plan-ID" }); return; }

    const parsed = addDaySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(404).json({ error: "Plan nicht gefunden" }); return; }

    const [day] = await db.insert(mealPlanDaysTable).values({ mealPlanId: planId, dayNumber: parsed.data.dayNumber }).returning();
    res.status(201).json({ id: day.id, mealPlanId: day.mealPlanId, dayNumber: day.dayNumber, entries: [] });
  } catch (err) {
    req.log.error({ err }, "Failed to add day");
    res.status(500).json({ error: "Internal server error" });
  }
});

const mealEntryInputSchema = z.object({
  mealType: z.string().min(1),
  recipeId: z.number().int().nullable().optional(),
  customNote: z.string().nullable().optional(),
});

router.post("/meal-plans/:id/days/:dayId/entries", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    const dayId = parseInt(req.params["dayId"] as string);
    if (isNaN(planId) || isNaN(dayId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const parsed = mealEntryInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(403).json({ error: "Zugriff verweigert" }); return; }

    const [day] = await db.select().from(mealPlanDaysTable).where(and(eq(mealPlanDaysTable.id, dayId), eq(mealPlanDaysTable.mealPlanId, planId)));
    if (!day) { res.status(404).json({ error: "Tag nicht gefunden" }); return; }

    if (parsed.data.recipeId) {
      const [r] = await db.select().from(recipesTable).where(eq(recipesTable.id, parsed.data.recipeId)).limit(1);
      if (!r) { res.status(404).json({ error: "Rezept nicht gefunden" }); return; }
      if (!r.isPublic && r.userId !== userId) { res.status(403).json({ error: "Kein Zugriff auf dieses Rezept" }); return; }
    }

    const [entry] = await db.insert(mealEntriesTable).values({
      mealPlanDayId: dayId,
      mealType: parsed.data.mealType,
      recipeId: parsed.data.recipeId ?? null,
      customNote: parsed.data.customNote ?? null,
    }).returning();

    let recipe = null;
    if (entry.recipeId) {
      const [r] = await db.select().from(recipesTable).where(eq(recipesTable.id, entry.recipeId));
      if (r) {
        recipe = {
          id: r.id, userId: r.userId, title: r.title, description: r.description,
          prepTime: r.prepTime, cookTime: r.cookTime, servings: r.servings,
          instructions: r.instructions, tags: r.tags, aiGenerated: r.aiGenerated,
          energyType: r.energyType, isPublic: r.isPublic,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          ingredients: [],
        };
      }
    }

    res.status(201).json({
      id: entry.id,
      mealPlanDayId: entry.mealPlanDayId,
      mealType: entry.mealType,
      recipeId: entry.recipeId,
      customNote: entry.customNote,
      timeSlot: entry.timeSlot ? String(entry.timeSlot) : null,
      recipe,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add meal entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/meal-plans/:id/days/:dayId/entries/:entryId", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    const dayId = parseInt(req.params["dayId"] as string);
    const entryId = parseInt(req.params["entryId"] as string);
    if (isNaN(planId) || isNaN(dayId) || isNaN(entryId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const parsed = mealEntryInputSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(403).json({ error: "Zugriff verweigert" }); return; }

    const [day] = await db.select().from(mealPlanDaysTable).where(and(eq(mealPlanDaysTable.id, dayId), eq(mealPlanDaysTable.mealPlanId, planId)));
    if (!day) { res.status(404).json({ error: "Tag nicht gefunden" }); return; }

    const [entry] = await db.select().from(mealEntriesTable).where(and(eq(mealEntriesTable.id, entryId), eq(mealEntriesTable.mealPlanDayId, dayId)));
    if (!entry) { res.status(404).json({ error: "Eintrag nicht gefunden" }); return; }

    if (parsed.data.recipeId) {
      const [r] = await db.select().from(recipesTable).where(eq(recipesTable.id, parsed.data.recipeId)).limit(1);
      if (!r) { res.status(404).json({ error: "Rezept nicht gefunden" }); return; }
      if (!r.isPublic && r.userId !== userId) { res.status(403).json({ error: "Kein Zugriff auf dieses Rezept" }); return; }
    }

    const [updated] = await db.update(mealEntriesTable).set({
      mealType: parsed.data.mealType,
      recipeId: parsed.data.recipeId ?? null,
      customNote: parsed.data.customNote ?? null,
    }).where(eq(mealEntriesTable.id, entryId)).returning();

    let recipe = null;
    if (updated.recipeId) {
      const [r] = await db.select().from(recipesTable).where(eq(recipesTable.id, updated.recipeId));
      if (r) {
        recipe = {
          id: r.id, userId: r.userId, title: r.title, description: r.description,
          prepTime: r.prepTime, cookTime: r.cookTime, servings: r.servings,
          instructions: r.instructions, tags: r.tags, aiGenerated: r.aiGenerated,
          energyType: r.energyType, isPublic: r.isPublic,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
          ingredients: [],
        };
      }
    }

    res.json({
      id: updated.id,
      mealPlanDayId: updated.mealPlanDayId,
      mealType: updated.mealType,
      recipeId: updated.recipeId,
      customNote: updated.customNote,
      timeSlot: updated.timeSlot ? String(updated.timeSlot) : null,
      recipe,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update meal entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/meal-plans/:id/days/:dayId/entries/:entryId", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const planId = parseInt(req.params["id"] as string);
    const dayId = parseInt(req.params["dayId"] as string);
    const entryId = parseInt(req.params["entryId"] as string);
    if (isNaN(planId) || isNaN(dayId) || isNaN(entryId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [plan] = await db.select().from(mealPlansTable).where(and(eq(mealPlansTable.id, planId), eq(mealPlansTable.userId, userId)));
    if (!plan) { res.status(403).json({ error: "Zugriff verweigert" }); return; }

    const [day] = await db.select().from(mealPlanDaysTable).where(and(eq(mealPlanDaysTable.id, dayId), eq(mealPlanDaysTable.mealPlanId, planId)));
    if (!day) { res.status(404).json({ error: "Tag nicht gefunden" }); return; }

    const [entry] = await db.select().from(mealEntriesTable).where(and(eq(mealEntriesTable.id, entryId), eq(mealEntriesTable.mealPlanDayId, dayId)));
    if (!entry) { res.status(404).json({ error: "Eintrag nicht gefunden" }); return; }

    await db.delete(mealEntriesTable).where(eq(mealEntriesTable.id, entryId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete meal entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
