import { Router } from "express";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
} from "@workspace/db";
import { eq, ilike, and, or, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import type { Recipe } from "@workspace/db";

const router = Router();

interface IngredientInput {
  ingredientId?: number | null;
  customName?: string | null;
  amount?: number | string;
  unit?: string;
  optional?: boolean;
}

type RecipeRow = Recipe & {
  ingredients: {
    id: number;
    ingredientId: number | null;
    customName: string | null;
    amount: number;
    unit: string;
    optional: boolean;
    ingredientName: string | null;
  }[];
};

async function getRecipeWithIngredients(id: number): Promise<RecipeRow | null> {
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
      ingredientName: ri.ingredientName ?? null,
    })),
  };
}

function formatRecipe(recipe: RecipeRow) {
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
    createdAt: recipe.createdAt instanceof Date ? recipe.createdAt.toISOString() : recipe.createdAt,
    ingredients: recipe.ingredients,
  };
}

function toIngredientRow(recipeId: number, ing: IngredientInput) {
  return {
    recipeId,
    ingredientId: ing.ingredientId ?? null,
    customName: ing.customName ?? null,
    amount: String(ing.amount ?? 1),
    unit: ing.unit ?? "g",
    optional: ing.optional ?? false,
  };
}

router.get("/recipes", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { energyType, search } = req.query as { energyType?: string; search?: string };

    const conditions = [
      or(eq(recipesTable.isPublic, true), eq(recipesTable.userId, userId)),
    ];

    if (energyType) {
      conditions.push(eq(recipesTable.energyType, energyType));
    }
    if (search) {
      conditions.push(ilike(recipesTable.title, `%${search}%`));
    }

    const recipes = await db.select().from(recipesTable).where(and(...conditions));

    const result = await Promise.all(recipes.map(r => getRecipeWithIngredients(r.id)));
    res.json(result.filter((r): r is RecipeRow => r !== null).map(formatRecipe));
  } catch (err) {
    req.log.error({ err }, "Failed to list recipes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recipes", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic } = req.body;
    const ingredients: IngredientInput[] = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];

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

    if (ingredients.length > 0) {
      await db.insert(recipeIngredientsTable).values(
        ingredients.map(ing => toIngredientRow(recipe.id, ing))
      );
    }

    const full = await getRecipeWithIngredients(recipe.id);
    res.status(201).json(formatRecipe(full!));
  } catch (err) {
    req.log.error({ err }, "Failed to create recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recipes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params["id"] as string);
    const recipe = await getRecipeWithIngredients(id);
    if (!recipe) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!recipe.isPublic && recipe.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
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
    const userId = req.userId!;
    const id = parseInt(req.params["id"] as string);

    const [existing] = await db
      .select({ id: recipesTable.id, userId: recipesTable.userId })
      .from(recipesTable)
      .where(eq(recipesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic } = req.body;
    const ingredients: IngredientInput[] | undefined = Array.isArray(req.body.ingredients) ? req.body.ingredients : undefined;

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

    if (ingredients !== undefined) {
      await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, id));
      if (ingredients.length > 0) {
        await db.insert(recipeIngredientsTable).values(
          ingredients.map(ing => toIngredientRow(id, ing))
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
    const userId = req.userId!;
    const id = parseInt(req.params["id"] as string);

    const [existing] = await db
      .select({ id: recipesTable.id, userId: recipesTable.userId })
      .from(recipesTable)
      .where(eq(recipesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(recipesTable).where(eq(recipesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete recipe");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
