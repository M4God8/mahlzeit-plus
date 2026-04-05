import { Router } from "express";
import { db } from "@workspace/db";
import {
  scannedProductsTable,
  userSettingsTable,
  nutritionProfilesTable,
  aiGenerationsTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { fetchProductFromOff } from "../services/offService";
import { fetchProductFromObf } from "../services/obfService";
import type { OffProduct } from "../services/offService";
import type { ObfProduct } from "../services/obfService";
import { calculateScore, calculateCosmeticScore, scoreLabel, scoreColor } from "../services/scoreService";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { CreateRecipeFromProductBody } from "@workspace/api-zod";
import { z } from "zod";

const router = Router();

async function getExcludedIngredients(userId: string): Promise<string[]> {
  const [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId));

  if (!settings || !settings.activeProfileIds.length) return [];

  const profiles = await db
    .select()
    .from(nutritionProfilesTable)
    .where(inArray(nutritionProfilesTable.id, settings.activeProfileIds));

  const excluded = new Set<string>();
  for (const p of profiles) {
    for (const ing of p.excludedIngredients) {
      excluded.add(ing);
    }
  }
  return Array.from(excluded);
}

type LookupResult =
  | { type: "food"; product: OffProduct }
  | { type: "cosmetic"; product: ObfProduct }
  | { type: "not_found" }
  | { type: "upstream_error" };

async function lookupProduct(barcode: string): Promise<LookupResult> {
  const offResult = await fetchProductFromOff(barcode);

  if (offResult !== null && offResult !== "upstream_error") {
    return { type: "food", product: offResult };
  }

  const obfResult = await fetchProductFromObf(barcode);

  if (obfResult !== null && obfResult !== "upstream_error") {
    return { type: "cosmetic", product: obfResult };
  }

  if (offResult === "upstream_error" && obfResult === "upstream_error") {
    return { type: "upstream_error" };
  }

  return { type: "not_found" };
}

router.get("/scanner/lookup/:barcode", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const barcode = (req.params["barcode"] as string).trim();

  console.log(`[Scanner] Lookup request barcode=${barcode} len=${barcode.length} raw=${JSON.stringify(req.params["barcode"])} userId=${userId}`);

  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    console.warn(`[Scanner] Invalid barcode format: ${barcode}`);
    res.status(400).json({ error: "Ungültiger Barcode" });
    return;
  }

  const [cached] = await db
    .select()
    .from(scannedProductsTable)
    .where(
      and(
        eq(scannedProductsTable.barcode, barcode),
        eq(scannedProductsTable.userId, userId)
      )
    )
    .orderBy(desc(scannedProductsTable.scannedAt))
    .limit(1);

  if (cached) {
    console.log(`[Scanner] Cache hit for barcode=${barcode}: ${cached.productName}`);
    res.json(cached);
    return;
  }

  const result = await lookupProduct(barcode);

  if (result.type === "upstream_error") {
    console.error(`[Scanner] Upstream error for barcode=${barcode}`);
    res.status(502).json({ error: "Externer Dienst nicht erreichbar — bitte erneut versuchen" });
    return;
  }

  if (result.type === "not_found") {
    console.warn(`[Scanner] Product not found for barcode=${barcode}`);
    res.status(404).json({ error: "Produkt nicht gefunden — manuelle Eingabe möglich", notFound: true });
    return;
  }

  const excludedIngredients = await getExcludedIngredients(userId);

  if (result.type === "cosmetic") {
    const product = result.product;
    const score = calculateCosmeticScore(product, excludedIngredients);

    const [inserted] = await db
      .insert(scannedProductsTable)
      .values({
        barcode,
        userId,
        productName: product.productName,
        brand: product.brand,
        imageUrl: product.imageUrl,
        ingredients: product.ingredients,
        nutriments: {},
        labels: product.labels,
        productType: "cosmetic",
        scoreIngredients: score.ingredients,
        scoreNutrition: score.nutrition,
        scoreProcessing: score.processing,
        scoreProfileFit: score.profileFit,
        totalScore: score.total,
        profileFitExclusions: score.profileFitExclusions,
        fluorideNote: score.fluorideNote ?? null,
      })
      .returning();

    console.log(`[Scanner] Saved cosmetic barcode=${barcode} name=${product.productName} score=${score.total}`);
    res.json(inserted);
    return;
  }

  const product = result.product;
  const score = calculateScore(product, excludedIngredients);

  const [inserted] = await db
    .insert(scannedProductsTable)
    .values({
      barcode,
      userId,
      productName: product.productName,
      brand: product.brand,
      imageUrl: product.imageUrl,
      ingredients: product.ingredients,
      nutriments: product.nutriments as Record<string, unknown>,
      labels: product.labels,
      productType: "food",
      scoreIngredients: score.ingredients,
      scoreNutrition: score.nutrition,
      scoreProcessing: score.processing,
      scoreProfileFit: score.profileFit,
      totalScore: score.total,
      profileFitExclusions: score.profileFitExclusions,
      contextLabel: score.contextLabel,
      warningFlags: score.warningFlags,
      summary: score.summary,
    })
    .returning();

  console.log(`[Scanner] Saved food barcode=${barcode} name=${product.productName} score=${score.total}`);
  res.json(inserted);
});

router.get("/scanner/score/:barcode", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const barcode = req.params["barcode"] as string;

  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    res.status(400).json({ error: "Ungültiger Barcode" });
    return;
  }

  const [cached] = await db
    .select()
    .from(scannedProductsTable)
    .where(
      and(
        eq(scannedProductsTable.barcode, barcode),
        eq(scannedProductsTable.userId, userId)
      )
    )
    .orderBy(desc(scannedProductsTable.scannedAt))
    .limit(1);

  if (cached) {
    const total = cached.totalScore;
    const pfScore = cached.scoreProfileFit;
    res.json({
      ingredients: cached.scoreIngredients,
      nutrition: cached.scoreNutrition,
      processing: cached.scoreProcessing,
      profileFit: pfScore,
      total,
      label: scoreLabel(total),
      color: scoreColor(total),
      contextLabel: cached.contextLabel ?? null,
      warningFlags: cached.warningFlags ?? [],
      summary: cached.summary ?? "",
      profileFitLabel: pfScore >= 20
        ? "✅ Passt gut zu deinem Profil"
        : pfScore >= 10
          ? "🟡 Mit Bedacht genießen"
          : "🔶 Für dein Profil nur eingeschränkt passend",
      profileFitExclusions: cached.profileFitExclusions,
      fluorideNote: cached.fluorideNote ?? null,
    });
    return;
  }

  const result = await lookupProduct(barcode);

  if (result.type === "upstream_error") {
    res.status(502).json({ error: "Externer Dienst nicht erreichbar — bitte erneut versuchen" });
    return;
  }

  if (result.type === "not_found") {
    res.status(404).json({ error: "Produkt nicht gefunden — manuelle Eingabe möglich", notFound: true });
    return;
  }

  const excludedIngredients = await getExcludedIngredients(userId);

  if (result.type === "cosmetic") {
    const score = calculateCosmeticScore(result.product, excludedIngredients);

    await db.insert(scannedProductsTable).values({
      barcode,
      userId,
      productName: result.product.productName,
      brand: result.product.brand,
      imageUrl: result.product.imageUrl,
      ingredients: result.product.ingredients,
      nutriments: {},
      labels: result.product.labels,
      productType: "cosmetic",
      scoreIngredients: score.ingredients,
      scoreNutrition: score.nutrition,
      scoreProcessing: score.processing,
      scoreProfileFit: score.profileFit,
      totalScore: score.total,
      profileFitExclusions: score.profileFitExclusions,
      fluorideNote: score.fluorideNote ?? null,
    });

    res.json(score);
    return;
  }

  const score = calculateScore(result.product, excludedIngredients);

  await db.insert(scannedProductsTable).values({
    barcode,
    userId,
    productName: result.product.productName,
    brand: result.product.brand,
    imageUrl: result.product.imageUrl,
    ingredients: result.product.ingredients,
    nutriments: result.product.nutriments as Record<string, unknown>,
    labels: result.product.labels,
    productType: "food",
    scoreIngredients: score.ingredients,
    scoreNutrition: score.nutrition,
    scoreProcessing: score.processing,
    scoreProfileFit: score.profileFit,
    totalScore: score.total,
    profileFitExclusions: score.profileFitExclusions,
    contextLabel: score.contextLabel,
    warningFlags: score.warningFlags,
    summary: score.summary,
  });

  res.json(score);
});

router.get("/scanner/history", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const rows = await db
    .select()
    .from(scannedProductsTable)
    .where(eq(scannedProductsTable.userId, userId))
    .orderBy(desc(scannedProductsTable.scannedAt))
    .limit(50);

  res.json(rows);
});

const AI_MODEL = "claude-sonnet-4-6";
const AI_MAX_TOKENS = 8192;

const RecipeOutputSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  servings: z.number(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      unit: z.string(),
    })
  ),
});

router.post("/scanner/create-recipe-from-product", requireAuth, async (req, res) => {
  const userId = req.userId!;

  let body: z.infer<typeof CreateRecipeFromProductBody>;
  try {
    body = CreateRecipeFromProductBody.parse(req.body);
  } catch {
    res.status(400).json({ error: "Ungültige Eingabe. barcode, productName und ingredients sind erforderlich." });
    return;
  }

  const { barcode, productName, ingredients } = body;

  if (productName.length > 200) {
    res.status(400).json({ error: "Produktname zu lang (max. 200 Zeichen)." });
    return;
  }
  if (ingredients.length > 4000) {
    res.status(400).json({ error: "Zutatenliste zu lang (max. 4000 Zeichen)." });
    return;
  }
  if (!ingredients.trim()) {
    res.status(400).json({ error: "Zutatenliste darf nicht leer sein." });
    return;
  }

  const systemPrompt = `Du bist ein kreativer Koch-Assistent, der aus industriell verarbeiteten Produkten verbesserte Heimrezepte erstellt.
Du analysierst die Zutatenliste eines gekauften Produkts und erstellst ein natürlicheres, hochwertigeres Rezept mit derselben Geschmacksrichtung.
Antworte IMMER mit einem validen JSON-Objekt ohne Markdown-Formatierung oder erklärenden Text.
Alle Texte auf Deutsch.

Wichtige Prinzipien:
- Kreativ statt algorithmisch: Mach das Rezept spannend und appetitlich, nicht nur eine 1:1-Kopie.
- TK-Alternativen anbieten: Wo sinnvoll, nenne Tiefkühl-Varianten als zeitsparende Option (z.B. "400g TK-Blattspinat (oder 600g frischer Spinat)").
- Regionale Optionen: Bevorzuge saisonale und regionale Zutaten, nenne Alternativen wenn möglich.
- Richtwert-Mengen: Mengenangaben sind Richtwerte — der Nutzer soll nach Geschmack anpassen können. Formuliere das in der Anleitung.
- Keine Zusatzstoffe: Ersetze künstliche Aromen, Stabilisatoren, Emulgatoren etc. durch natürliche Alternativen.
- Machbarkeit: Das Rezept soll mit normaler Küchenausstattung zuhause umsetzbar sein.`;

  const prompt = `Erstelle ein verbessertes Heimrezept inspiriert von diesem Produkt:

Produkt: "${productName}"
Original-Zutatenliste: ${ingredients}

Erstelle ein Rezept, das geschmacklich an das Original erinnert, aber mit natürlichen, hochwertigen Zutaten zubereitet wird.
Portionen: 2 (Richtwert).

Antworte mit folgendem JSON:
{
  "name": "Rezeptname (kreativ, appetitlich)",
  "description": "Kurze Beschreibung (1-2 Sätze, erwähne die Inspiration vom Original)",
  "instructions": "Detaillierte Schritt-für-Schritt Anleitung mit Richtwert-Hinweisen",
  "servings": 2,
  "prepTime": 15,
  "cookTime": 25,
  "tags": ["selbstgemacht", "natürlich", ...weitere passende Tags],
  "ingredients": [
    {"name": "Zutatname (ggf. mit TK-Alternative)", "amount": "200", "unit": "g"}
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
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

    let data: z.infer<typeof RecipeOutputSchema>;

    try {
      const parsed = extractJson(text);
      data = RecipeOutputSchema.parse(parsed);
    } catch {
      const repairResponse = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
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
      data = RecipeOutputSchema.parse(repairedParsed);
    }

    const costEur = (totalInputTokens * 0.000003 + totalOutputTokens * 0.000015).toFixed(6);
    await db.insert(aiGenerationsTable).values({
      userId,
      type: "scanner-recipe",
      input: `product:${productName} barcode:${barcode}`,
      output: data as Record<string, unknown>,
      model: AI_MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costEur,
    });

    res.json(data);
  } catch (err) {
    console.error("[Scanner] Recipe generation failed:", err);
    res.status(500).json({ error: "KI-Rezepterstellung fehlgeschlagen. Bitte erneut versuchen." });
  }
});

export default router;
