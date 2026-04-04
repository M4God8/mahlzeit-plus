import type { OffProduct } from "./offService";
import type { ObfProduct } from "./obfService";

export interface SugarContext {
  hasNaturalSugar: boolean;
  hasIndustrialSugar: boolean;
  hasFruitSugar: boolean;
}

export interface ScoreBreakdown {
  ingredients: number;
  nutrition: number;
  processing: number;
  profileFit: number;
  total: number;
  label: string;
  color: "green" | "yellow" | "orange" | "red";
  contextLabel: string | null;
  warningFlags: string[];
  summary: string;
  profileFitLabel: string;
  profileFitExclusions: string[];
  fluorideNote?: string | null;
}

function cap(score: number, min = 0, max = 25): number {
  return Math.min(max, Math.max(min, Math.round(score)));
}

export function getCacaoPercent(product: OffProduct): number | null {
  const nameMatch = product.productName?.match(/(\d+)\s*%.*kakao|kakao.*?(\d+)\s*%/i);
  if (nameMatch) {
    const val = parseInt(nameMatch[1] || nameMatch[2], 10);
    if (val > 0 && val <= 100) return val;
  }

  const ingMatch = product.ingredients?.match(/kakaomasse.*?(\d+)|kakaoanteil.*?(\d+)|davon kakao.*?(\d+)/i);
  if (ingMatch) {
    const val = parseInt(ingMatch[1] || ingMatch[2] || ingMatch[3], 10);
    if (val > 0 && val <= 100) return val;
  }

  return null;
}

export function getSugarContext(ingredientsText: string): SugarContext {
  const lc = ingredientsText.toLowerCase();
  return {
    hasNaturalSugar: /rohrzucker|kokosblütenzucker|dattelsirup|ahornsirup/i.test(lc),
    hasIndustrialSugar: /\bzucker\b|glukosesirup|fruktosesirup|maissirup|maltodextrin/i.test(lc),
    hasFruitSugar: /fruchtsaft|fruchtpüree|apfelsaft|fruchtzucker(?!sirup)/i.test(lc),
  };
}

export function hasFluoride(ingredientsText: string): boolean {
  return /natriumfluorid|sodium fluoride|fluoridiertes wasser/i.test(ingredientsText);
}

function calcIngredients(product: OffProduct): number {
  let score = 25;

  const additivesN = product.additives_n ?? 0;
  score -= additivesN * 5;

  const lc = (product.ingredients ?? "").toLowerCase();

  if (/aroma|flavou?r/i.test(lc) && /künstlich|artificial|identisch/i.test(lc)) {
    score -= 3;
  }

  if (/konservierungsstoff|preservative|sorbat|benzoat|säuerungsmittel/i.test(lc)) {
    score -= 3;
  }

  if (/\bunbekannt|nicht deklariert/i.test(lc)) {
    score -= 1;
  }

  const labelStr = product.labels.join(" ").toLowerCase();
  if (/bio|organic|ökologisch/i.test(labelStr)) {
    score += 4;
  }
  if (/fairtrade|fair-trade/i.test(labelStr)) {
    score += 2;
  }

  return cap(score);
}

function calcNutrition(product: OffProduct): number {
  const n = product.nutriments;
  if (!n || Object.keys(n).length === 0) return 12;

  let score = 25;

  const sugar = n.sugars_100g ?? 0;
  if (sugar > 30) score -= 15;
  else if (sugar > 15) score -= 10;
  else if (sugar > 5) score -= 3;

  const cacao = getCacaoPercent(product);
  const satFat = n["saturated-fat_100g"] ?? 0;
  if (satFat > 10) {
    score -= cacao !== null && cacao > 70 ? 3 : 6;
  }

  const protein = n.proteins_100g ?? 0;
  if (protein > 10) score += 3;

  const fiber = n.fiber_100g ?? 0;
  if (protein < 2 && fiber < 1) {
    score -= 12;
  }

  return cap(score);
}

function calcProcessing(product: OffProduct): number {
  let score = 25;

  const nova = product.nova_group;
  if (nova === 4) score -= 15;
  else if (nova === 3) score -= 5;

  const lc = (product.ingredients ?? "").toLowerCase();
  if (/maltodextrin|sirup/i.test(lc)) {
    score -= 3;
  }

  const n = product.nutriments;
  const protein = n?.proteins_100g ?? 0;
  const fiber = n?.fiber_100g ?? 0;
  const sugar = n?.sugars_100g ?? 0;
  if (nova === 4 && protein < 2 && fiber < 1 && sugar > 5) {
    score -= 8;
  }

  return cap(score);
}

function calcProfileFit(
  product: OffProduct,
  excludedIngredients: string[]
): {
  score: number;
  label: string;
  contextLabel: string | null;
  warningFlags: string[];
  exclusions: string[];
} {
  let penalty = 0;
  let contextLabel: string | null = null;
  const warningFlags: string[] = [];

  const lc = (product.ingredients ?? "").toLowerCase();
  const exclusions = excludedIngredients.filter((ex) => lc.includes(ex.toLowerCase()));

  if (hasFluoride(product.ingredients ?? "")) {
    warningFlags.push("⚠️ Enthält Fluorid");
  }

  const avoidSugar = excludedIngredients.some(
    (e) => e.toLowerCase() === "zucker" || e.toLowerCase() === "süßungsmittel"
  );

  const sugar = product.nutriments?.sugars_100g ?? 0;

  if (avoidSugar) {
    if (sugar > 15) penalty = 22;
    else if (sugar > 10) penalty = 18;
    else if (sugar > 5) penalty = 8;
    else penalty = 0;

    const sugarCtx = getSugarContext(product.ingredients ?? "");

    if (sugarCtx.hasIndustrialSugar) {
      penalty *= 1.0;
    } else if (sugarCtx.hasNaturalSugar) {
      penalty *= 0.6;
    } else if (sugarCtx.hasFruitSugar) {
      penalty *= 0.3;
    }

    const cacao = getCacaoPercent(product);
    if (cacao !== null && cacao > 70 && sugar < 15) {
      penalty *= 0.5;
      contextLabel = "Bewusstes Genussmittel";
    } else if (sugarCtx.hasFruitSugar && !sugarCtx.hasIndustrialSugar) {
      penalty *= 0.4;
      contextLabel = "Natürlicher Fruchtzucker";
    }
  }

  const nonSugarExclusions = exclusions.filter(
    (e) => e.toLowerCase() !== "zucker" && e.toLowerCase() !== "süßungsmittel"
  );
  penalty += nonSugarExclusions.length * 10;

  const score = cap(25 - penalty);

  let label: string;
  if (score >= 20) {
    label = "✅ Passt gut zu deinem Profil";
  } else if (score >= 10) {
    label = "🟡 Mit Bedacht genießen";
  } else {
    label = "🔶 Für dein Profil nur eingeschränkt passend";
  }

  return { score, label, contextLabel, warningFlags, exclusions };
}

export function scoreLabel(total: number): string {
  if (total >= 85) return "Sehr empfehlenswert";
  if (total >= 65) return "Gut — gelegentlich";
  if (total >= 40) return "Mit Bedacht genießen";
  return "Weniger passend für deinen Alltag";
}

export function scoreColor(total: number): "green" | "yellow" | "orange" | "red" {
  if (total >= 85) return "green";
  if (total >= 65) return "yellow";
  if (total >= 40) return "orange";
  return "red";
}

function scoreSummary(total: number): string {
  if (total >= 85) return "Natürlich, hochwertig und passend für deinen Alltag";
  if (total >= 65) return "Solide Qualität mit kleinen Einschränkungen";
  if (total >= 40) return "Für den Alltag weniger geeignet — gelegentlich okay";
  return "Viele Kompromisse bei Qualität oder Inhaltsstoffen";
}

export function calculateScore(
  product: OffProduct,
  excludedIngredients: string[]
): ScoreBreakdown {
  const ingredients = calcIngredients(product);
  const nutrition = calcNutrition(product);
  const processing = calcProcessing(product);
  const {
    score: profileFit,
    label: profileFitLabel,
    contextLabel,
    warningFlags,
    exclusions: profileFitExclusions,
  } = calcProfileFit(product, excludedIngredients);

  const weighted =
    ingredients * 0.3 +
    nutrition * 0.3 +
    processing * 0.2 +
    profileFit * 0.2;
  const total = Math.min(100, Math.max(0, Math.round(weighted * 4)));

  return {
    ingredients,
    nutrition,
    processing,
    profileFit,
    total,
    label: scoreLabel(total),
    color: scoreColor(total),
    contextLabel,
    warningFlags,
    summary: scoreSummary(total),
    profileFitLabel,
    profileFitExclusions,
  };
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

const E_NUMBER_RE = /\bE\s*\d{3,4}[a-z]?\b/gi;

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
  const found = FLUORIDE_KEYWORDS.some((kw) => lc.includes(kw));
  if (found) {
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

function calcCosmeticProfileFit(
  ingredients: string,
  excludedIngredients: string[]
): { score: number; exclusions: string[] } {
  const lc = ingredients.toLowerCase();
  const exclusions = excludedIngredients.filter((ex) => lc.includes(ex.toLowerCase()));
  let score = 25;
  score -= exclusions.length * 8;
  return { score: cap(score), exclusions };
}

export function calculateCosmeticScore(
  product: ObfProduct,
  excludedIngredients: string[]
): ScoreBreakdown {
  const ingredientsScore = calcCosmeticNaturalness(product.ingredients);
  const nutritionScore = calcIngredientClarity(product.ingredients);
  const processingScore = calcCosmeticQualityBonus(product.labels);
  const { score: profileFit, exclusions: profileFitExclusions } = calcCosmeticProfileFit(
    product.ingredients,
    excludedIngredients
  );
  const total = ingredientsScore + nutritionScore + profileFit + processingScore;
  const fluorideNote = detectFluoride(product);

  let profileFitLabel: string;
  if (profileFit >= 20) {
    profileFitLabel = "✅ Passt gut zu deinem Profil";
  } else if (profileFit >= 10) {
    profileFitLabel = "🟡 Mit Bedacht genießen";
  } else {
    profileFitLabel = "🔶 Für dein Profil nur eingeschränkt passend";
  }

  return {
    ingredients: ingredientsScore,
    nutrition: nutritionScore,
    processing: processingScore,
    profileFit,
    total,
    label: scoreLabel(total),
    color: scoreColor(total),
    contextLabel: null,
    warningFlags: [],
    summary: scoreSummary(total),
    profileFitLabel,
    profileFitExclusions,
    fluorideNote,
  };
}
