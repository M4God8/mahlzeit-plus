import { Router } from "express";
import { db } from "@workspace/db";
import {
  scannedProductsTable,
  userSettingsTable,
  nutritionProfilesTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { fetchProductFromOff } from "../services/offService";
import { fetchProductFromObf } from "../services/obfService";
import type { OffProduct } from "../services/offService";
import type { ObfProduct } from "../services/obfService";
import { calculateScore, calculateCosmeticScore, ScoreBreakdownSchema } from "../services/scoreService";

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
  const barcode = req.params["barcode"] as string;

  console.log(`[Scanner] Lookup request barcode=${barcode} userId=${userId}`);

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
    res.status(404).json({ error: "Produkt nicht gefunden", notFound: true });
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
        scoreNaturalness: score.naturalness,
        scoreNutrientBalance: score.nutrientBalance,
        scoreProfileFit: score.profileFit,
        scoreQualityBonus: score.qualityBonus,
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
      scoreNaturalness: score.naturalness,
      scoreNutrientBalance: score.nutrientBalance,
      scoreProfileFit: score.profileFit,
      scoreQualityBonus: score.qualityBonus,
      totalScore: score.total,
      profileFitExclusions: score.profileFitExclusions,
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
    const score = ScoreBreakdownSchema.parse({
      naturalness: cached.scoreNaturalness,
      nutrientBalance: cached.scoreNutrientBalance,
      profileFit: cached.scoreProfileFit,
      qualityBonus: cached.scoreQualityBonus,
      total: cached.totalScore,
      profileFitExclusions: cached.profileFitExclusions,
      label: cached.totalScore >= 80 ? "Sehr empfehlenswert"
        : cached.totalScore >= 60 ? "Gut — gelegentlich"
        : cached.totalScore >= 40 ? "Mit Bedacht"
        : "Lieber vermeiden",
      color: cached.totalScore >= 80 ? "green"
        : cached.totalScore >= 60 ? "yellow"
        : cached.totalScore >= 40 ? "orange"
        : "red",
      fluorideNote: cached.fluorideNote ?? null,
    });
    res.json(score);
    return;
  }

  const result = await lookupProduct(barcode);

  if (result.type === "upstream_error") {
    res.status(502).json({ error: "Externer Dienst nicht erreichbar — bitte erneut versuchen" });
    return;
  }

  if (result.type === "not_found") {
    res.status(404).json({ error: "Produkt nicht gefunden", notFound: true });
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
      scoreNaturalness: score.naturalness,
      scoreNutrientBalance: score.nutrientBalance,
      scoreProfileFit: score.profileFit,
      scoreQualityBonus: score.qualityBonus,
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
    scoreNaturalness: score.naturalness,
    scoreNutrientBalance: score.nutrientBalance,
    scoreProfileFit: score.profileFit,
    scoreQualityBonus: score.qualityBonus,
    totalScore: score.total,
    profileFitExclusions: score.profileFitExclusions,
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

export default router;
