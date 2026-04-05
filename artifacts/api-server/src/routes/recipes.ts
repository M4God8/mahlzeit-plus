import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
  aiGenerationsTable,
} from "@workspace/db";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AiGenerateRecipeResponse } from "@workspace/api-zod";
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
    source: recipe.source ?? null,
    sourceNote: recipe.sourceNote ?? null,
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
    const { energyType, search, tags, maxTime } = req.query as { energyType?: string; search?: string; tags?: string; maxTime?: string };

    const conditions = [
      or(eq(recipesTable.isPublic, true), eq(recipesTable.userId, userId)),
    ];

    if (energyType) {
      conditions.push(eq(recipesTable.energyType, energyType));
    }
    if (search) {
      conditions.push(ilike(recipesTable.title, `%${search}%`));
    }
    if (tags) {
      conditions.push(sql`array_to_string(${recipesTable.tags}, ',') ilike ${'%' + tags + '%'}`);
    }
    if (maxTime) {
      const maxMinutes = parseInt(maxTime, 10);
      if (!isNaN(maxMinutes)) {
        conditions.push(sql`(${recipesTable.prepTime} + ${recipesTable.cookTime}) <= ${maxMinutes}`);
      }
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
    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic, source, sourceNote } = req.body;
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
        ...(source !== undefined && { source }),
        ...(sourceNote !== undefined && { sourceNote }),
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

    const { title, description, prepTime, cookTime, servings, instructions, tags, energyType, isPublic, source, sourceNote } = req.body;
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
        ...(source !== undefined && { source }),
        ...(sourceNote !== undefined && { sourceNote }),
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Nur JPG und PNG Bilder sind erlaubt."));
    }
  },
});

function runMulterUpload(req: import("express").Request, res: import("express").Response): Promise<Express.Multer.File[]> {
  return new Promise((resolve, reject) => {
    upload.array("images", 5)(req, res, (err: unknown) => {
      if (err) return reject(err);
      resolve((req.files as Express.Multer.File[]) || []);
    });
  });
}

const VISION_MODEL = "claude-sonnet-4-6";

router.post(
  "/recipes/import-screenshot",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const userId = req.userId!;
      let files: Express.Multer.File[];
      try {
        files = await runMulterUpload(req, res);
      } catch (uploadErr) {
        if (uploadErr instanceof multer.MulterError) {
          if (uploadErr.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "Bild zu groß. Maximale Größe: 10 MB." });
            return;
          }
          res.status(400).json({ error: "Fehler beim Hochladen der Datei." });
          return;
        }
        if (uploadErr instanceof Error && uploadErr.message.includes("Nur JPG")) {
          res.status(400).json({ error: uploadErr.message });
          return;
        }
        throw uploadErr;
      }

      if (!files || files.length === 0) {
        res.status(400).json({ error: "Bitte lade mindestens ein Bild hoch." });
        return;
      }

      const imageContent = await Promise.all(files.map(async (file) => {
        let buffer = file.buffer;
        let mediaType = file.mimetype as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        const MAX_SIZE = 4 * 1024 * 1024;

        if (buffer.length > MAX_SIZE) {
          const sharp = (await import("sharp")).default;
          buffer = await sharp(buffer)
            .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          mediaType = "image/jpeg";
        }

        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType,
            data: buffer.toString("base64"),
          },
        };
      }));

      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "KI-Dienst nicht verfügbar. Bitte später erneut versuchen." });
        return;
      }

      const systemPrompt = `Du bist ein Rezept-Erkennungs-Assistent. Du analysierst Screenshots von Rezepten (z.B. von TikTok, Instagram, Kochseiten) und extrahierst alle Rezeptdaten.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.
Wenn du ein Feld nicht sicher erkennen kannst, setze den Wert auf "?" (bei Strings) oder 0 (bei Zahlen).
Alle Texte auf Deutsch.`;

      const prompt = `Analysiere diese(n) Screenshot(s) und extrahiere das Rezept. Antworte mit folgendem JSON:
{
  "name": "Rezeptname",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "instructions": "Detaillierte Schritt-für-Schritt Anleitung",
  "servings": 2,
  "prepTime": 15,
  "cookTime": 25,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {"name": "Zutatname", "amount": "200", "unit": "g"}
  ]
}

Wenn kein Rezept erkennbar ist, antworte mit:
{"error": "Kein Rezept erkennbar"}`;

      const response = await anthropic.messages.create({
        model: VISION_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [...imageContent, { type: "text" as const, text: prompt }],
          },
        ],
      });

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");

      let parsed: unknown;
      try {
        const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = codeBlock ? codeBlock[1]!.trim() : text.trim();
        parsed = JSON.parse(candidate);
      } catch {
        res.status(400).json({ error: "Die KI konnte kein Rezept aus dem Bild extrahieren." });
        return;
      }

      if (parsed && typeof parsed === "object" && "error" in parsed) {
        res.status(400).json({ error: (parsed as { error: string }).error });
        return;
      }

      const result = AiGenerateRecipeResponse.safeParse(parsed);
      if (!result.success) {
        res.status(400).json({ error: "Das extrahierte Rezept hat ein ungültiges Format." });
        return;
      }

      const costEur = (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6);
      await db.insert(aiGenerationsTable).values({
        userId,
        type: "import-screenshot",
        input: `screenshot:${files.length} images`,
        output: result.data as Record<string, unknown>,
        model: VISION_MODEL,
        inputTokens,
        outputTokens,
        costEur,
      });

      res.json(result.data);
    } catch (err) {
      req.log.error({ err }, "Failed to import recipe from screenshot");
      res.status(500).json({ error: "Fehler beim Verarbeiten des Screenshots." });
    }
  }
);

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
