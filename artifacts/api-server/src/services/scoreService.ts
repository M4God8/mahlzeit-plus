import { z } from "zod";
import type { OffProduct, OffNutriments } from "./offService";
import type { ObfProduct } from "./obfService";

export const ScoreBreakdownSchema = z.object({
  naturalness: z.number().int().min(0).max(25),
  nutrientBalance: z.number().int().min(0).max(25),
  profileFit: z.number().int().min(0).max(25),
  qualityBonus: z.number().int().min(0).max(25),
  total: z.number().int().min(0).max(100),
  profileFitExclusions: z.array(z.string()),
  label: z.string(),
  color: z.enum(["green", "yellow", "orange", "red"]),
  fluorideNote: z.string().nullable().optional(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

const E_NUMBER_RE = /\bE\s*\d{3,4}[a-z]?\b/gi;
const ALARM_INGREDIENTS = [
  "sirup",
  "maissirup",
  "high fructose",
  "fructose-glucose",
  "palmöl",
  "palm oil",
  "hydrogenated",
  "gehärtet",
  "hydrolysiert",
  "nitrit",
  "natriumbenzoat",
  "carrageen",
  "aspartam",
  "acesulfam",
  "saccharin",
  "cyclamat",
  "tartrazin",
  "gelb",
];

function calcNaturalness(ingredients: string): number {
  if (!ingredients) return 12;
  const lc = ingredients.toLowerCase();
  const eCount = (ingredients.match(E_NUMBER_RE) ?? []).length;
  const alarmCount = ALARM_INGREDIENTS.filter((a) => lc.includes(a)).length;
  const wordCount = ingredients.split(",").length;

  let score = 25;
  score -= Math.min(eCount * 3, 15);
  score -= Math.min(alarmCount * 4, 12);
  if (wordCount > 20) score -= 3;
  if (wordCount > 30) score -= 2;
  return Math.max(0, Math.min(25, score));
}

function calcNutrientBalance(n: OffNutriments): number {
  if (!n || Object.keys(n).length === 0) return 12;
  let score = 25;

  const sugar = n.sugars_100g ?? 0;
  const fat = n.fat_100g ?? 0;
  const satFat = n["saturated-fat_100g"] ?? 0;
  const salt = n.salt_100g ?? 0;
  const protein = n.proteins_100g ?? 0;
  const fiber = n.fiber_100g ?? 0;

  if (sugar > 22.5) score -= 6;
  else if (sugar > 10) score -= 3;

  if (satFat > 5) score -= 6;
  else if (satFat > 2.5) score -= 3;

  if (salt > 1.5) score -= 4;
  else if (salt > 0.75) score -= 2;

  if (fat > 17.5) score -= 3;

  if (protein >= 12) score += 3;
  else if (protein >= 6) score += 1;

  if (fiber >= 6) score += 3;
  else if (fiber >= 3) score += 2;

  return Math.max(0, Math.min(25, score));
}

function calcProfileFit(
  ingredients: string,
  excludedIngredients: string[]
): { score: number; exclusions: string[] } {
  if (!excludedIngredients.length) return { score: 25, exclusions: [] };
  const lc = ingredients.toLowerCase();
  const found = excludedIngredients.filter((ex) => lc.includes(ex.toLowerCase()));
  const score = found.length === 0 ? 25 : Math.max(0, 25 - found.length * 10);
  return { score, exclusions: found };
}

function calcQualityBonus(labels: string[]): number {
  const labelStr = labels.join(" ").toLowerCase();
  let score = 10;

  if (labelStr.includes("organic") || labelStr.includes("bio") || labelStr.includes("ökologisch")) score += 6;
  if (labelStr.includes("fairtrade") || labelStr.includes("fair-trade")) score += 3;
  if (labelStr.includes("regional")) score += 3;
  if (labelStr.includes("rainforest")) score += 2;
  if (labelStr.includes("vegan")) score += 1;

  return Math.min(25, score);
}

export function scoreLabel(total: number): string {
  if (total >= 80) return "Sehr empfehlenswert";
  if (total >= 60) return "Gut — gelegentlich";
  if (total >= 40) return "Mit Bedacht";
  return "Lieber vermeiden";
}

export function scoreColor(total: number): "green" | "yellow" | "orange" | "red" {
  if (total >= 80) return "green";
  if (total >= 60) return "yellow";
  if (total >= 40) return "orange";
  return "red";
}

export function calculateScore(
  product: OffProduct,
  excludedIngredients: string[]
): ScoreBreakdown {
  const naturalness = calcNaturalness(product.ingredients);
  const nutrientBalance = calcNutrientBalance(product.nutriments);
  const { score: profileFit, exclusions: profileFitExclusions } = calcProfileFit(
    product.ingredients,
    excludedIngredients
  );
  const qualityBonus = calcQualityBonus(product.labels);
  const total = naturalness + nutrientBalance + profileFit + qualityBonus;

  const raw = {
    naturalness,
    nutrientBalance,
    profileFit,
    qualityBonus,
    total,
    profileFitExclusions,
    label: scoreLabel(total),
    color: scoreColor(total),
  };

  return ScoreBreakdownSchema.parse(raw);
}

const COSMETIC_ALARM_INGREDIENTS = [
  "paraben", "methylparaben", "ethylparaben", "propylparaben", "butylparaben",
  "silikon", "silicone", "dimethicone", "cyclomethicone", "cyclopentasiloxane",
  "mineralöl", "mineral oil", "paraffin", "petrolatum", "vaseline",
  "peg-", "polyethylene glycol",
  "microplastik", "microplastic", "polyethylene", "polypropylene", "nylon-",
  "formaldehyd", "formaldehyde",
  "triclosan",
  "bht", "bha",
  "sodium lauryl sulfate", "sodium laureth sulfate", "sls", "sles",
];

const TOOTHPASTE_KEYWORDS = [
  "zahnpasta", "zahncreme", "toothpaste", "dentifrice", "dental",
  "zahnpflege", "tooth", "zahn",
];

const FLUORIDE_KEYWORDS = [
  "fluorid", "fluoride", "sodium fluoride", "natriumfluorid",
  "stannous fluoride", "zinnfluorid", "amin fluorid", "olaflur",
];

function isToothpaste(product: ObfProduct): boolean {
  const searchText = [
    product.productName,
    product.categories?.join(" ") ?? "",
  ].join(" ").toLowerCase();
  return TOOTHPASTE_KEYWORDS.some((kw) => searchText.includes(kw));
}

function detectFluoride(product: ObfProduct): string | null {
  if (!isToothpaste(product)) return null;
  const lc = product.ingredients.toLowerCase();
  const hasFluoride = FLUORIDE_KEYWORDS.some((kw) => lc.includes(kw));
  if (hasFluoride) {
    return "Enthält Fluorid — ein gängiger Wirkstoff zur Kariesvorbeugung.";
  }
  return "Kein Fluorid erkannt — fluoridfreie Zahnpasta.";
}

function calcCosmeticNaturalness(ingredients: string): number {
  if (!ingredients) return 12;
  const lc = ingredients.toLowerCase();
  const alarmCount = COSMETIC_ALARM_INGREDIENTS.filter((a) => lc.includes(a)).length;
  const eCount = (ingredients.match(E_NUMBER_RE) ?? []).length;

  let score = 25;
  score -= Math.min(alarmCount * 3, 15);
  score -= Math.min(eCount * 2, 8);
  return Math.max(0, Math.min(25, score));
}

function calcIngredientClarity(ingredients: string): number {
  if (!ingredients) return 12;
  const parts = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
  const count = parts.length;

  let score = 25;
  if (count > 30) score -= 8;
  else if (count > 20) score -= 4;
  else if (count > 15) score -= 2;

  const longNames = parts.filter((p) => p.length > 25).length;
  score -= Math.min(longNames * 1, 5);

  if (count <= 8) score += 2;

  return Math.max(0, Math.min(25, score));
}

function calcCosmeticQualityBonus(labels: string[]): number {
  const labelStr = labels.join(" ").toLowerCase();
  let score = 10;

  if (labelStr.includes("naturkosmetik") || labelStr.includes("natural cosmetic") || labelStr.includes("natrue")) score += 5;
  if (labelStr.includes("organic") || labelStr.includes("bio") || labelStr.includes("ökologisch")) score += 4;
  if (labelStr.includes("vegan")) score += 3;
  if (labelStr.includes("tierversuchsfrei") || labelStr.includes("cruelty-free") || labelStr.includes("cruelty free") || labelStr.includes("leaping bunny")) score += 3;
  if (labelStr.includes("ecocert") || labelStr.includes("cosmos")) score += 2;
  if (labelStr.includes("fairtrade") || labelStr.includes("fair-trade")) score += 2;

  return Math.min(25, score);
}

export function calculateCosmeticScore(
  product: ObfProduct,
  excludedIngredients: string[]
): ScoreBreakdown {
  const naturalness = calcCosmeticNaturalness(product.ingredients);
  const nutrientBalance = calcIngredientClarity(product.ingredients);
  const { score: profileFit, exclusions: profileFitExclusions } = calcProfileFit(
    product.ingredients,
    excludedIngredients
  );
  const qualityBonus = calcCosmeticQualityBonus(product.labels);
  const total = naturalness + nutrientBalance + profileFit + qualityBonus;
  const fluorideNote = detectFluoride(product);

  const raw = {
    naturalness,
    nutrientBalance,
    profileFit,
    qualityBonus,
    total,
    profileFitExclusions,
    label: scoreLabel(total),
    color: scoreColor(total),
    fluorideNote,
  };

  return ScoreBreakdownSchema.parse(raw);
}
