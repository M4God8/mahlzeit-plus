import { db } from "@workspace/db";
import { ingredientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const OFF_PRICES_API = "https://prices.openfoodfacts.org/api/v1";

interface OffLocation {
  osm_id?: number;
  osm_type?: string;
  osm_display_name?: string;
}

interface OffPriceResult {
  product_code: string;
  price: number;
  currency: string;
  location_osm_id?: number;
  location_osm_type?: string;
  location?: OffLocation;
}

interface OffPriceResponse {
  items: OffPriceResult[];
  total: number;
}

const INGREDIENT_SEARCH_OVERRIDES: Record<string, string> = {
  "Möhren": "karotten",
  "Porree": "lauch",
  "Linsen (rot)": "linsen rot",
  "Schwarze Bohnen": "schwarze bohnen",
  "Weiße Bohnen": "weiße bohnen",
  "Hühnerbrust": "hähnchenbrust",
  "Naturjoghurt": "joghurt natur",
  "Vollkornnudeln": "vollkorn nudeln",
  "Basmatireis": "basmati reis",
  "Naturreis": "natur reis",
};

function getSearchTerm(ingredientName: string): string {
  return INGREDIENT_SEARCH_OVERRIDES[ingredientName] ?? ingredientName.toLowerCase();
}

const GERMANY_LOCATION_PATTERNS = [
  "deutschland",
  "germany",
  ", de",
  "berlin",
  "münchen",
  "hamburg",
  "köln",
  "frankfurt",
  "stuttgart",
  "düsseldorf",
  "dortmund",
  "essen",
  "leipzig",
  "bremen",
  "dresden",
  "hannover",
  "nürnberg",
];

function isGermanLocation(item: OffPriceResult): boolean {
  const displayName = item.location?.osm_display_name?.toLowerCase() ?? "";
  if (!displayName) return false;
  return GERMANY_LOCATION_PATTERNS.some(pattern => displayName.includes(pattern));
}

async function fetchPricesForProduct(searchTerm: string): Promise<{ min: number; max: number; avg: number } | null> {
  try {
    const url = `${OFF_PRICES_API}/prices?product_name_like=${encodeURIComponent(searchTerm)}&currency=EUR&order_by=-date&page_size=50`;
    const response = await fetch(url, {
      headers: { "User-Agent": "MahlzeitPlus/1.0 (contact@mahlzeit.app)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json() as OffPriceResponse;
    if (!data.items || data.items.length === 0) return null;

    let filteredItems = data.items.filter(item => item.currency === "EUR" && item.price > 0 && isGermanLocation(item));

    if (filteredItems.length < 3) {
      filteredItems = data.items.filter(item => item.currency === "EUR" && item.price > 0);
      logger.debug({ searchTerm, deCount: 0, totalCount: filteredItems.length }, "Not enough DE-specific prices, using all EUR prices as fallback");
    }

    const prices = filteredItems.map(item => item.price);

    if (prices.length < 3) return null;

    const sorted = prices.sort((a, b) => a - b);
    const trimCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    if (trimmed.length === 0) return null;

    const min = trimmed[0]!;
    const max = trimmed[trimmed.length - 1]!;
    const avg = trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length;

    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      avg: Math.round(avg * 100) / 100,
    };
  } catch (err) {
    logger.warn({ err, searchTerm }, "Failed to fetch price from Open Food Facts");
    return null;
  }
}

export async function updatePricesFromOpenFoodFacts(): Promise<{ updated: number; failed: number; skipped: number }> {
  logger.info("Starting price update from Open Food Facts...");

  const allIngredients = await db.select().from(ingredientsTable);
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const ingredient of allIngredients) {
    const searchTerm = getSearchTerm(ingredient.name);

    try {
      const prices = await fetchPricesForProduct(searchTerm);
      if (!prices) {
        logger.debug({ ingredient: ingredient.name, searchTerm }, "No OFF prices found — keeping existing");
        skipped++;
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }

      const currentMin = ingredient.priceMin ? parseFloat(ingredient.priceMin) : 0;
      const currentMax = ingredient.priceMax ? parseFloat(ingredient.priceMax) : 0;
      if (currentMin > 0 && (prices.min > currentMax * 5 || prices.max < currentMin * 0.1)) {
        logger.warn({ ingredient: ingredient.name, prices, currentMin, currentMax }, "OFF price diverges >5x from existing — skipping to avoid bad data");
        skipped++;
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }

      await db
        .update(ingredientsTable)
        .set({
          priceMin: String(prices.min),
          priceMax: String(prices.max),
          priceAvg: String(prices.avg),
          priceUpdatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, ingredient.id));

      updated++;
      logger.debug({ ingredient: ingredient.name, prices }, "Price updated");

      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      logger.error({ err, ingredient: ingredient.name }, "Failed to update price");
      failed++;
    }
  }

  logger.info({ updated, failed, skipped }, "Price update completed");
  return { updated, failed, skipped };
}
