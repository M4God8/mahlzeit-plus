import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import {
  recipesTable,
  recipeIngredientsTable,
  ingredientsTable,
  aiGenerationsTable,
  mealFeedbackTable,
  userSettingsTable,
  nutritionProfilesTable,
  mealEntriesTable,
  mealPlanDaysTable,
  mealPlansTable,
  userLearnedPreferencesTable,
} from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
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

interface LearnedPrefs {
  avgPreferredPrepTime: number | null;
  preferredMealComplexity: string;
  frequentlyReplacedRecipeIds: number[];
  frequentlyReplacedRecipeTitles: string[];
}

const BUDGET_EURO_MAP: Record<string, number> = {
  low: 35,
  medium: 50,
  high: 75,
};

interface UserContext {
  householdSize: number;
  cookTimeLimit: number;
  budgetLevel: string;
  budgetEuro: number;
  bioPreferred: boolean;
  profileNames: string[];
  excludedIngredients: string[];
  preferredCategories: string[];
  mealStyles: string[];
  learnedPrefs: LearnedPrefs | null;
}

async function getUserContext(userId: string): Promise<UserContext> {
  const [[settings], [learnedRow]] = await Promise.all([
    db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)),
    db.select().from(userLearnedPreferencesTable).where(eq(userLearnedPreferencesTable.userId, userId)),
  ]);

  let learnedPrefs: LearnedPrefs | null = null;
  if (learnedRow) {
    const ids = learnedRow.frequentlyReplacedRecipeIds;
    let frequentlyReplacedRecipeTitles: string[] = [];
    if (ids.length > 0) {
      const recipeRows = await db
        .select({ id: recipesTable.id, title: recipesTable.title })
        .from(recipesTable)
        .where(inArray(recipesTable.id, ids));
      frequentlyReplacedRecipeTitles = recipeRows.map((r) => r.title);
    }
    learnedPrefs = {
      avgPreferredPrepTime: learnedRow.avgPreferredPrepTime,
      preferredMealComplexity: learnedRow.preferredMealComplexity,
      frequentlyReplacedRecipeIds: ids,
      frequentlyReplacedRecipeTitles,
    };
  }

  if (!settings) {
    return {
      householdSize: 2,
      cookTimeLimit: 30,
      budgetLevel: "medium",
      budgetEuro: BUDGET_EURO_MAP["medium"]!,
      bioPreferred: false,
      profileNames: [],
      excludedIngredients: [],
      preferredCategories: [],
      mealStyles: [],
      learnedPrefs,
    };
  }

  let profileNames: string[] = [];
  let excludedIngredients: string[] = [];
  let preferredCategories: string[] = [];
  let mealStyles: string[] = [];

  if (settings.activeProfileIds.length > 0) {
    const profiles = await db
      .select()
      .from(nutritionProfilesTable)
      .where(inArray(nutritionProfilesTable.id, settings.activeProfileIds));
    profileNames = profiles.map((p) => p.name);
    excludedIngredients = [...new Set(profiles.flatMap((p) => p.excludedIngredients))];
    preferredCategories = [...new Set(profiles.flatMap((p) => p.preferredCategories))];
    mealStyles = [...new Set(profiles.map((p) => p.mealStyle))];
  }

  return {
    householdSize: settings.householdSize,
    cookTimeLimit: settings.cookTimeLimit,
    budgetLevel: settings.budgetLevel,
    budgetEuro: BUDGET_EURO_MAP[settings.budgetLevel] ?? BUDGET_EURO_MAP["medium"]!,
    bioPreferred: settings.bioPreferred,
    profileNames,
    excludedIngredients,
    preferredCategories,
    mealStyles,
    learnedPrefs,
  };
}

function buildContextBlock(ctx: UserContext): string {
  const lines: string[] = [];
  lines.push(`Haushaltsgröße: ${ctx.householdSize} Person(en)`);
  lines.push(`Maximale Kochzeit: ${ctx.cookTimeLimit} Minuten`);
  lines.push(`Budget: ${ctx.budgetLevel === "low" ? "sparsam" : ctx.budgetLevel === "high" ? "großzügig" : "mittel"} (${ctx.budgetEuro}€/Woche)`);
  lines.push(`Budget des Nutzers: ${ctx.budgetEuro}€/Woche. Plane Mahlzeiten die darunter oder max. 10% darüber liegen. Bei leichter Überschreitung (bis 10%): trotzdem vorschlagen mit kurzem Hinweis ("Liegt leicht über deinem Budget…"). Nie hart ablehnen — bei deutlicher Überschreitung bevorzuge günstigere Alternativen, zeige teurere Option aber als Alternativ-Vorschlag.`);
  if (ctx.bioPreferred) lines.push("Bio-Produkte werden bevorzugt.");
  if (ctx.profileNames.length > 0) lines.push(`Ernährungsstil: ${ctx.profileNames.join(", ")}`);
  if (ctx.mealStyles.length > 0) lines.push(`Mahlzeitenstil: ${ctx.mealStyles.join(", ")}`);
  if (ctx.preferredCategories.length > 0) lines.push(`Bevorzugte Kategorien: ${ctx.preferredCategories.join(", ")}`);
  if (ctx.excludedIngredients.length > 0) lines.push(`AUSGESCHLOSSENE ZUTATEN (NIEMALS verwenden): ${ctx.excludedIngredients.join(", ")}`);

  if (ctx.learnedPrefs) {
    lines.push("\n--- Gelerntes Nutzerprofil ({{learned_preferences}}) ---");
    if (ctx.learnedPrefs.avgPreferredPrepTime !== null) {
      lines.push(`Bevorzugte Zubereitungszeit (aus Feedback): Ø ${ctx.learnedPrefs.avgPreferredPrepTime} Minuten`);
    }
    const complexityMap: Record<string, string> = {
      simple: "einfach und schnell",
      varied: "abwechslungsreich und aufwendig",
      mixed: "ausgewogen",
    };
    lines.push(`Mahlzeitkomplexität-Präferenz: ${complexityMap[ctx.learnedPrefs.preferredMealComplexity] ?? "ausgewogen"}`);
    if (ctx.learnedPrefs.frequentlyReplacedRecipeIds.length > 0) {
      const titles = ctx.learnedPrefs.frequentlyReplacedRecipeTitles;
      const recipeList =
        titles.length > 0
          ? titles.join(", ")
          : ctx.learnedPrefs.frequentlyReplacedRecipeIds.map((id) => `ID ${id}`).join(", ");
      lines.push(`Häufig abgelehnte Rezepte (BITTE VERMEIDEN): ${recipeList}`);
    }
  } else {
    lines.push("\n--- Gelerntes Nutzerprofil ({{learned_preferences}}) ---");
    lines.push("Noch kein Lernprofil vorhanden — Standardpräferenzen anwenden.");
  }

  return lines.join("\n");
}

interface KiCallResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
}

async function safeKiCall<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  systemPrompt: string,
): Promise<KiCallResult<T>> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  let totalInputTokens = response.usage?.input_tokens ?? 0;
  let totalOutputTokens = response.usage?.output_tokens ?? 0;

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  function extractJson(raw: string): unknown {
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = codeBlock ? codeBlock[1]!.trim() : raw.trim();
    return JSON.parse(candidate);
  }

  try {
    const parsed = extractJson(text);
    return { data: schema.parse(parsed), inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
  } catch {
    const repairResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: "Du bist ein JSON-Reparatur-Assistent. Antworte NUR mit dem reparierten JSON-Objekt, ohne Markdown oder Text.",
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: text },
        {
          role: "user",
          content: "Das war kein valides JSON. Antworte jetzt NUR mit dem korrekten JSON-Objekt, ohne ```-Blöcke oder anderen Text.",
        },
      ],
    });

    totalInputTokens += repairResponse.usage?.input_tokens ?? 0;
    totalOutputTokens += repairResponse.usage?.output_tokens ?? 0;

    const repairText = repairResponse.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    const repairedParsed = JSON.parse(repairText);
    return { data: schema.parse(repairedParsed), inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
  }
}

router.post("/ai/generate-recipe", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiGenerateRecipeBody.parse(req.body);
  const ctx = await getUserContext(userId);

  const systemPrompt = `Du bist ein kreativer Koch-Assistent für bewusstes und natürliches Essen. 
Du erstellst gesunde, saisonale Rezepte auf Deutsch.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.

Nutzerprofil:
${buildContextBlock(ctx)}`;

  const prompt = `Erstelle ein Rezept für: "${body.prompt}".
${body.tags?.length ? `Gewünschte Tags: ${body.tags.join(", ")}.` : ""}
${body.servings ? `Portionen: ${body.servings}.` : `Portionen: ${ctx.householdSize}.`}

Antworte mit folgendem JSON:
{
  "name": "Rezeptname",
  "description": "Kurze Beschreibung (1-2 Sätze)",
  "instructions": "Detaillierte Schritt-für-Schritt Anleitung",
  "servings": ${body.servings ?? ctx.householdSize},
  "prepTime": 15,
  "cookTime": 25,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    {"name": "Zutatname", "amount": "200", "unit": "g"}
  ]
}`;

  const { data, inputTokens, outputTokens } = await safeKiCall(AiGenerateRecipeResponse, prompt, systemPrompt);
  const costEur = (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "generate-recipe",
    input: body.prompt,
    output: data as Record<string, unknown>,
    model: MODEL,
    inputTokens,
    outputTokens,
    costEur,
  });

  res.json(data);
});

router.post("/ai/generate-plan", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiGeneratePlanBody.parse(req.body);
  const ctx = await getUserContext(userId);

  const systemPrompt = `Du bist ein Ernährungsberater für bewusstes und natürliches Essen. 
Du erstellst ausgewogene Wochenspeisepläne auf Deutsch.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.

Nutzerprofil:
${buildContextBlock(ctx)}`;

  const prompt = `Erstelle einen Wochenspeiseplan (7 Tage: Montag bis Sonntag) mit je 3 Mahlzeiten (Frühstück, Mittagessen, Abendessen).
Nutzerpräferenzen: "${body.preferences}"

Antworte mit folgendem JSON:
{
  "weekTitle": "Wochenplan: Kurze Beschreibung",
  "days": [
    {
      "day": "Montag",
      "meals": [
        {"mealType": "Frühstück", "suggestion": "Haferporridge", "description": "Mit Beeren und Nüssen"},
        {"mealType": "Mittagessen", "suggestion": "Gemüsesuppe", "description": "Saisonal und frisch"},
        {"mealType": "Abendessen", "suggestion": "Salat mit Quinoa", "description": "Leicht und sättigend"}
      ]
    }
  ],
  "notes": "Allgemeine Hinweise zum Plan"
}`;

  const { data, inputTokens, outputTokens } = await safeKiCall(AiGeneratePlanResponse, prompt, systemPrompt);
  const costEur = (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "generate-plan",
    input: body.preferences,
    output: data as Record<string, unknown>,
    model: MODEL,
    inputTokens,
    outputTokens,
    costEur,
  });

  res.json(data);
});

router.post("/ai/adjust-recipe", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiAdjustRecipeBody.parse(req.body);

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, body.recipeId));

  if (!recipe) {
    res.status(404).json({ error: "Rezept nicht gefunden" });
    return;
  }
  if (!recipe.isPublic && recipe.userId !== userId) {
    res.status(403).json({ error: "Kein Zugriff auf dieses Rezept" });
    return;
  }

  const ctx = await getUserContext(userId);

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

  const systemPrompt = `Du bist ein Koch-Assistent. Du passt bestehende Rezepte an Nutzerwünsche an.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.

Nutzerprofil:
${buildContextBlock(ctx)}`;

  const prompt = `Passe dieses Rezept an: "${recipe.title}"
Zutaten: ${ingredients.map((i) => `${i.amount} ${i.unit} ${i.name ?? i.customName}`).join(", ")}

Anpassungswunsch: "${body.adjustmentPrompt}"

Antworte mit folgendem JSON:
{
  "name": "Angepasster Rezeptname",
  "description": "Kurze Beschreibung",
  "instructions": "Angepasste Zubereitung",
  "servings": ${recipe.servings},
  "prepTime": ${recipe.prepTime},
  "cookTime": ${recipe.cookTime},
  "tags": ["tag1"],
  "ingredients": [
    {"name": "Zutat", "amount": "200", "unit": "g"}
  ]
}`;

  const { data, inputTokens, outputTokens } = await safeKiCall(AiAdjustRecipeResponse, prompt, systemPrompt);
  const costEur = (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "adjust-recipe",
    input: `${recipe.id}:${body.adjustmentPrompt}`,
    output: data as Record<string, unknown>,
    model: MODEL,
    inputTokens,
    outputTokens,
    costEur,
  });

  res.json(data);
});

router.post("/ai/substitute-ingredient", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiSubstituteIngredientBody.parse(req.body);

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, body.recipeId));

  if (!recipe) {
    res.status(404).json({ error: "Rezept nicht gefunden" });
    return;
  }
  if (!recipe.isPublic && recipe.userId !== userId) {
    res.status(403).json({ error: "Kein Zugriff auf dieses Rezept" });
    return;
  }

  const ctx = await getUserContext(userId);

  const systemPrompt = `Du bist ein Koch-Experte für Zutaten-Substitutionen. 
Du schlägst passende Alternativen für nicht verfügbare oder unerwünschte Zutaten vor.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.

Nutzerprofil:
${buildContextBlock(ctx)}`;

  const prompt = `Für das Rezept "${recipe.title}" werden Alternativen gesucht für: ${body.ingredients.join(", ")}.
${body.reason ? `Grund: ${body.reason}` : ""}

Beachte besonders die ausgeschlossenen Zutaten aus dem Nutzerprofil — diese dürfen NICHT als Ersatz vorgeschlagen werden.

Antworte mit folgendem JSON:
{
  "substitutions": [
    {
      "original": "Original-Zutat",
      "substitute": "Ersatz-Zutat",
      "ratio": "1:1",
      "reasoning": "Warum dieser Ersatz funktioniert (Textur, Funktion im Rezept)",
      "tasteImpact": "Wie der Geschmack sich verändert (leichter, süßer, nussiger etc.)",
      "notes": "Praktische Hinweise zur Verwendung"
    }
  ],
  "generalAdvice": "Allgemeiner Rat zum Ersetzen"
}`;

  const { data, inputTokens, outputTokens } = await safeKiCall(AiSubstituteIngredientResponse, prompt, systemPrompt);
  const costEur = (inputTokens * 0.000003 + outputTokens * 0.000015).toFixed(6);

  await db.insert(aiGenerationsTable).values({
    userId,
    type: "substitute-ingredient",
    input: body.ingredients.join(","),
    output: data as Record<string, unknown>,
    model: MODEL,
    inputTokens,
    outputTokens,
    costEur,
  });

  res.json(data);
});

router.post("/ai/save-recipe", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiSaveRecipeBody.parse(req.body);

  const [saved] = await db
    .insert(recipesTable)
    .values({
      userId,
      title: body.name,
      description: body.description ?? "",
      instructions: body.instructions,
      servings: body.servings,
      prepTime: body.prepTime ?? 10,
      cookTime: body.cookTime ?? 20,
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

      const ingredientId: number | null = existing.length > 0 ? existing[0]!.id : null;

      await db.insert(recipeIngredientsTable).values({
        recipeId: saved.id,
        ingredientId,
        customName: ingredientId ? null : ing.name,
        amount: ing.amount,
        unit: ing.unit,
        optional: false,
      });
    }
  }

  const [fullRecipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, saved.id));
  const ingredients = await db
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
    .where(eq(recipeIngredientsTable.recipeId, saved.id));

  res.status(201).json({
    ...fullRecipe,
    tags: fullRecipe!.tags ?? [],
    createdAt: fullRecipe!.createdAt instanceof Date ? fullRecipe!.createdAt.toISOString() : fullRecipe!.createdAt,
    ingredients: ingredients.map(ri => ({
      id: ri.id,
      ingredientId: ri.ingredientId,
      customName: ri.customName,
      amount: parseFloat(String(ri.amount)) || 0,
      unit: ri.unit,
      optional: ri.optional,
      ingredientName: ri.ingredientName ?? null,
    })),
  });
});

router.post("/ai/feedback", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const body = AiSubmitFeedbackBody.parse(req.body);

  if (body.mealEntryId == null && body.recipeId == null) {
    res.status(400).json({ error: "mealEntryId oder recipeId muss angegeben werden" });
    return;
  }

  if (body.mealEntryId != null) {
    const [entry] = await db
      .select({ id: mealEntriesTable.id })
      .from(mealEntriesTable)
      .innerJoin(mealPlanDaysTable, eq(mealEntriesTable.mealPlanDayId, mealPlanDaysTable.id))
      .innerJoin(mealPlansTable, eq(mealPlanDaysTable.mealPlanId, mealPlansTable.id))
      .where(and(eq(mealEntriesTable.id, body.mealEntryId), eq(mealPlansTable.userId, userId)));
    if (!entry) {
      res.status(403).json({ error: "Meal entry not found or access denied" });
      return;
    }
  }

  if (body.recipeId != null) {
    const [recipe] = await db
      .select({ id: recipesTable.id, userId: recipesTable.userId, isPublic: recipesTable.isPublic })
      .from(recipesTable)
      .where(eq(recipesTable.id, body.recipeId));
    if (!recipe || (recipe.userId !== userId && !recipe.isPublic)) {
      res.status(403).json({ error: "Recipe not found or access denied" });
      return;
    }
  }

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
