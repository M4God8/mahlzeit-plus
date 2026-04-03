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
import { calculateScore, ScoreBreakdownSchema } from "../services/scoreService";

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

router.get("/scanner/lookup/:barcode", requireAuth, async (req, res) => {
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
    res.json(cached);
    return;
  }

  const product = await fetchProductFromOff(barcode);

  if (!product) {
    res.status(404).json({ error: "Produkt nicht gefunden" });
    return;
  }

  const excludedIngredients = await getExcludedIngredients(userId);
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
      scoreNaturalness: score.naturalness,
      scoreNutrientBalance: score.nutrientBalance,
      scoreProfileFit: score.profileFit,
      scoreQualityBonus: score.qualityBonus,
      totalScore: score.total,
      profileFitExclusions: score.profileFitExclusions,
    })
    .returning();

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
    });
    res.json(score);
    return;
  }

  const product = await fetchProductFromOff(barcode);
  if (!product) {
    res.status(404).json({ error: "Produkt nicht gefunden" });
    return;
  }

  const excludedIngredients = await getExcludedIngredients(userId);
  const score = calculateScore(product, excludedIngredients);
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
