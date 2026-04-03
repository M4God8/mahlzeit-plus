import { Router } from "express";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
} from "@workspace/db";
import { eq, or, ilike, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function getRecipeWithIngredients(id: number) {
  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, id));
  if (!recipe) return null;

  const recipeIngredients = await db
    .select({
      id: recipeIngredientsTable.id,
      ingredientId: recipeIngredientsTable.ingredientId,
      customName: recipeIngredientsTable.customName,
      amount: recipeIngredientsTable.amount,
      unit: recipeIngredientsTable.unit,
      optional: recipeIngredientsTable.optional,
      ingredientName: ingredientsTable.name,
    })
    .from(recipeIngredientsTable)
    .leftJoin(ingredientsTable, eq(recipeIngredientsTable.ingredientId, ingredientsTable.id))
    .where(eq(recipeIngredientsTable.recipeId, id));

  return {
    ...recipe,
    tags: recipe.tags ?? [],
    ingredients: recipeIngredients.map(ri => ({
      id: ri.id,
      ingredientId: ri.ingredientId,
      customName: ri.customName,
      amount: parseFloat(ri.amount) || 0,
      unit: ri.unit,
      optional: ri.optional,
      ingredientName: ri.ingredientName,
    })),
  };
}

function formatRecipe(recipe: any) {
  return {
    id: recipe.id,
    userId: recipe.userId,
    title: recipe.title,
    description: recipe.description,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    instructions: recipe.instructions,
    tags: recipe.tags ?? [],
    aiGenerated: recipe.aiGenerated,
    energyType: recipe.energyType,
    isPublic: recipe.isPublic,
    createdAt: recipe.createdAt?.toISOString?.() ?? recipe.createdAt,
    ingredients: recipe.ingredients ?? [],
  };
}

router.get("/recipes", async (req, res): Promise<void> => {
  try {
    const { energyType, search } = req.query as { energyType?: string; search?: string };
    const conditions = [];

    if (energyType) {
      conditions.push(eq(recipesTable.energyType, energyType));
    }
    if (search) {
      conditions.push(ilike(recipesTable.title, `%${search}%`));
    }

    const recipes = conditions.length > 0
      ? await db.select().from(recipesTable).where(and(...conditions))
      : await db.select().from(recipesTable);

    const result = await Promise.all(recipes.map(r => getRecipeWithIngredients(r.id)));
    res.json(result.filter(Boolean).map(formatRecipe));
  } catch (err) {
    req.log.error({ err }, "Failed to list recipes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recipes", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).userId as string;
    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic, ingredients } = req.body;

    const [recipe] = await db
      .insert(recipesTable)
      .values({
        userId,
        title,
        description,
        prepTime: prepTime ?? 10,
        cookTime: cookTime ?? 20,
        servings: servings ?? 2,
        instructions: instructions ?? "",
        tags: tags ?? [],
        energyType: energyType ?? "leicht",
        isPublic: isPublic ?? false,
      })
      .returning();

    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      await db.insert(recipeIngredientsTable).values(
        ingredients.map((ing: any) => ({
          recipeId: recipe.id,
          ingredientId: ing.ingredientId ?? null,
          customName: ing.customName ?? null,
          amount: String(ing.amount ?? 1),
          unit: ing.unit ?? "g",
          optional: ing.optional ?? false,
        }))
      );
    }

    const full = await getRecipeWithIngredients(recipe.id);
    res.status(201).json(formatRecipe(full));
  } catch (err) {
    req.log.error({ err }, "Failed to create recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const recipe = await getRecipeWithIngredients(id);
    if (!recipe) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatRecipe(recipe));
  } catch (err) {
    req.log.error({ err }, "Failed to get recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic, ingredients } = req.body;

    await db
      .update(recipesTable)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(prepTime !== undefined && { prepTime }),
        ...(cookTime !== undefined && { cookTime }),
        ...(servings !== undefined && { servings }),
        ...(instructions !== undefined && { instructions }),
        ...(tags !== undefined && { tags }),
        ...(energyType !== undefined && { energyType }),
        ...(isPublic !== undefined && { isPublic }),
      })
      .where(eq(recipesTable.id, id));

    if (ingredients && Array.isArray(ingredients)) {
      await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, id));
      if (ingredients.length > 0) {
        await db.insert(recipeIngredientsTable).values(
          ingredients.map((ing: any) => ({
            recipeId: id,
            ingredientId: ing.ingredientId ?? null,
            customName: ing.customName ?? null,
            amount: String(ing.amount ?? 1),
            unit: ing.unit ?? "g",
            optional: ing.optional ?? false,
          }))
        );
      }
    }

    const full = await getRecipeWithIngredients(id);
    if (!full) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(formatRecipe(full));
  } catch (err) {
    req.log.error({ err }, "Failed to update recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(recipesTable).where(eq(recipesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
