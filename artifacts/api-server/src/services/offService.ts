export interface OffNutriments {
  energy_100g?: number;
  fat_100g?: number;
  "saturated-fat_100g"?: number;
  sugars_100g?: number;
  proteins_100g?: number;
  salt_100g?: number;
  fiber_100g?: number;
}

export interface OffProduct {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl: string;
  ingredients: string;
  nutriments: OffNutriments;
  labels: string[];
}

interface OffApiProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  nutriments?: Record<string, number>;
  labels?: string;
  labels_tags?: string[];
  nova_group?: number;
}

interface OffApiResponse {
  status: number;
  product?: OffApiProduct;
}

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const TIMEOUT_MS = 8000;

export async function fetchProductFromOff(barcode: string): Promise<OffProduct | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `${OFF_BASE}/${encodeURIComponent(barcode)}?fields=product_name,brands,image_url,ingredients_text,nutriments,labels,labels_tags,nova_group`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "MahlzeitPlus/1.0 (https://mahlzeit.app)" },
      }
    );

    if (!res.ok) return null;

    const json = (await res.json()) as OffApiResponse;
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;

    const rawNutriments: Record<string, number> = (p.nutriments ?? {}) as Record<string, number>;
    const nutriments: OffNutriments = {
      energy_100g: typeof rawNutriments["energy-kcal_100g"] === "number" ? rawNutriments["energy-kcal_100g"] : undefined,
      fat_100g: typeof rawNutriments["fat_100g"] === "number" ? rawNutriments["fat_100g"] : undefined,
      "saturated-fat_100g": typeof rawNutriments["saturated-fat_100g"] === "number" ? rawNutriments["saturated-fat_100g"] : undefined,
      sugars_100g: typeof rawNutriments["sugars_100g"] === "number" ? rawNutriments["sugars_100g"] : undefined,
      proteins_100g: typeof rawNutriments["proteins_100g"] === "number" ? rawNutriments["proteins_100g"] : undefined,
      salt_100g: typeof rawNutriments["salt_100g"] === "number" ? rawNutriments["salt_100g"] : undefined,
      fiber_100g: typeof rawNutriments["fiber_100g"] === "number" ? rawNutriments["fiber_100g"] : undefined,
    };

    const labels: string[] = p.labels_tags?.map((l) => l.replace(/^[a-z]{2}:/, "")) ?? 
      (p.labels ? p.labels.split(",").map((l) => l.trim().toLowerCase()) : []);

    return {
      barcode,
      productName: p.product_name ?? "",
      brand: p.brands ?? "",
      imageUrl: p.image_url ?? "",
      ingredients: p.ingredients_text ?? "",
      nutriments,
      labels,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
