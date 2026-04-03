import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
  aiGenerationsTable,
  mealFeedbackTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import {
  AiGenerateRecipeBody,
  AiGenerateRecipeResponse,
  AiGeneratePlanBody,
  AiGeneratePlanResponse,
  AiAdjustRecipeBody,
  AiAdjustRecipeResponse,
  AiSubstituteIngredientBody,
  AiSubstituteIngredientResponse,
  AiSaveRecipeBody,
  AiSubmitFeedbackBody,
} from "@workspace/api-zod";
import { z } from "zod";

const router = Router();

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

async function safeKiCall<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  systemPrompt: string,
): Promise<T> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
    text.match(/\{[\s\S]*\}/) ||
    text.match(/\[[\s\S]*\]/);

  let rawJson = jsonMatch
    ? jsonMatch[1] ?? jsonMatch[0]
    : text;

  rawJson = rawJson.trim();

  const parsed = JSON.parse(rawJson);
  return schema.parse(parsed);
}

router.post("/ai/generate-recipe", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiGenerateRecipeBody.parse(req.body);

  const systemPrompt = `Du bist ein kreativer Koch-Assistent für bewusstes und natürliches Essen. 
Du sprichst Deutsch und erstellst gesunde, saisonale Rezepte.
Antworte IMMER mit einem validen JSON-Objekt im exakten Format ohne zusätzlichen Text.`;

  const prompt = `Erstelle ein Rezept für: "${body.prompt}".
${body.tags?.length ? `Tags: ${body.tags.join(", ")}.` : ""}
${body.servings ? `Portionen: ${body.servings}.` : "Portionen: 2."}

Antworte mit folgendem JSON-Format:
\`\`\`json
{
  "name": "Rezeptname",
  "description": "Kurze Beschreibung",
  "instructions": "Schritt-für-Schritt Anleitung",
  "servings": 2,
  "prepTime": 15,
  "cookTime": 30,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {"name": "Zutat", "amount": "200", "unit": "g"}
  ]
}
\`\`\``;

  const result = await safeKiCall(AiGenerateRecipeResponse, prompt, systemPrompt);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "generate-recipe",
    input: body.prompt,
    output: result as Record<string, unknown>,
    model: MODEL,
  });

  res.json(result);
});

router.post("/ai/generate-plan", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiGeneratePlanBody.parse(req.body);

  const systemPrompt = `Du bist ein Ernährungsberater für bewusstes und natürliches Essen. 
Du erstellst ausgewogene Wochenspeisepläne auf Deutsch.
Antworte IMMER mit einem validen JSON-Objekt ohne zusätzlichen Text.`;

  const prompt = `Erstelle einen Wochenspeiseplan basierend auf folgenden Präferenzen: "${body.preferences}".

Antworte mit folgendem JSON-Format:
\`\`\`json
{
  "weekTitle": "Wochenplan KW XX",
  "days": [
    {
      "day": "Montag",
      "meals": [
        {"mealType": "Frühstück", "suggestion": "Haferporridge", "description": "Mit Beeren und Nüssen"},
        {"mealType": "Mittagessen", "suggestion": "Gemüsesuppe", "description": "Saisonal und frisch"},
        {"mealType": "Abendessen", "suggestion": "Salat", "description": "Mit Quinoa"}
      ]
    }
  ],
  "notes": "Allgemeine Hinweise"
}
\`\`\`
Erstelle Pläne für alle 7 Tage (Montag bis Sonntag) mit je 3 Mahlzeiten.`;

  const result = await safeKiCall(AiGeneratePlanResponse, prompt, systemPrompt);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "generate-plan",
    input: body.preferences,
    output: result as Record<string, unknown>,
    model: MODEL,
  });

  res.json(result);
});

router.post("/ai/adjust-recipe", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiAdjustRecipeBody.parse(req.body);

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, body.recipeId));

  if (!recipe) {
    res.status(404).json({ error: "Rezept nicht gefunden" });
    return;
  }

  const ingredients = await db
    .select({
      name: ingredientsTable.name,
      customName: recipeIngredientsTable.customName,
      amount: recipeIngredientsTable.amount,
      unit: recipeIngredientsTable.unit,
    })
    .from(recipeIngredientsTable)
    .leftJoin(ingredientsTable, eq(recipeIngredientsTable.ingredientId, ingredientsTable.id))
    .where(eq(recipeIngredientsTable.recipeId, recipe.id));

  const systemPrompt = `Du bist ein Koch-Assistent. Du passt bestehende Rezepte an Wünsche an.
Antworte IMMER mit einem validen JSON-Objekt ohne zusätzlichen Text.`;

  const prompt = `Passe dieses Rezept an: "${recipe.name}"
Zutaten: ${ingredients.map((i) => `${i.amount} ${i.unit} ${i.name ?? i.customName}`).join(", ")}

Anpassungswunsch: "${body.adjustmentPrompt}"

Antworte mit folgendem JSON-Format:
\`\`\`json
{
  "name": "Angepasster Rezeptname",
  "description": "Kurze Beschreibung",
  "instructions": "Angepasste Anleitung",
  "servings": 2,
  "prepTime": 15,
  "cookTime": 30,
  "tags": ["tag1"],
  "ingredients": [
    {"name": "Zutat", "amount": "200", "unit": "g"}
  ]
}
\`\`\``;

  const result = await safeKiCall(AiAdjustRecipeResponse, prompt, systemPrompt);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "adjust-recipe",
    input: `${recipe.id}:${body.adjustmentPrompt}`,
    output: result as Record<string, unknown>,
    model: MODEL,
  });

  res.json(result);
});

router.post("/ai/substitute-ingredient", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiSubstituteIngredientBody.parse(req.body);

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, body.recipeId));

  if (!recipe) {
    res.status(404).json({ error: "Rezept nicht gefunden" });
    return;
  }

  const systemPrompt = `Du bist ein Koch-Experte für Zutaten-Substitutionen. Du schlägst passende Alternativen vor.
Antworte IMMER mit einem validen JSON-Objekt ohne zusätzlichen Text.`;

  const prompt = `Für das Rezept "${recipe.name}" fehlen folgende Zutaten: ${body.ingredients.join(", ")}.
${body.reason ? `Grund: ${body.reason}` : ""}

Schlage Alternativen vor und antworte mit folgendem JSON-Format:
\`\`\`json
{
  "substitutions": [
    {
      "original": "Original-Zutat",
      "substitute": "Ersatz-Zutat",
      "ratio": "1:1",
      "notes": "Hinweis"
    }
  ],
  "generalAdvice": "Allgemeiner Rat"
}
\`\`\``;

  const result = await safeKiCall(AiSubstituteIngredientResponse, prompt, systemPrompt);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "substitute-ingredient",
    input: body.ingredients.join(","),
    output: result as Record<string, unknown>,
    model: MODEL,
  });

  res.json(result);
});

router.post("/ai/save-recipe", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiSaveRecipeBody.parse(req.body);

  const [saved] = await db
    .insert(recipesTable)
    .values({
      userId,
      name: body.name,
      description: body.description ?? "",
      instructions: body.instructions,
      servings: body.servings,
      prepTime: body.prepTime ?? null,
      cookTime: body.cookTime ?? null,
      tags: body.tags ?? [],
      aiGenerated: true,
      isPublic: false,
    })
    .returning();

  if (!saved) {
    res.status(500).json({ error: "Rezept konnte nicht gespeichert werden" });
    return;
  }

  if (body.ingredients?.length) {
    for (const ing of body.ingredients) {
      const existing = await db
        .select()
        .from(ingredientsTable)
        .where(eq(ingredientsTable.name, ing.name));

      let ingredientId: number | null = null;
      if (existing.length > 0) {
        ingredientId = existing[0]!.id;
      }

      await db.insert(recipeIngredientsTable).values({
        recipeId: saved.id,
        ingredientId,
        customName: ingredientId ? null : ing.name,
        amount: parseFloat(ing.amount) || 1,
        unit: ing.unit,
        optional: false,
      });
    }
  }

  const fullRecipe = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, saved.id));

  res.status(201).json(fullRecipe[0]);
});

router.post("/ai/feedback", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const body = AiSubmitFeedbackBody.parse(req.body);

  const [feedback] = await db
    .insert(mealFeedbackTable)
    .values({
      userId,
      mealEntryId: body.mealEntryId ?? null,
      recipeId: body.recipeId ?? null,
      rating: body.rating,
    })
    .returning();

  res.status(201).json(feedback);
});

export default router;
