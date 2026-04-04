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
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

export type OffResult = OffProduct | null | "upstream_error";

async function singleFetch(barcode: string, attempt: number): Promise<OffResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `${OFF_BASE}/${encodeURIComponent(barcode)}?fields=product_name,brands,image_url,ingredients_text,nutriments,labels,labels_tags,nova_group`;

  console.log(`[OFF] Attempt ${attempt}/${MAX_RETRIES} fetching barcode=${barcode} url=${url}`);

  try {
    const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "MahlzeitPlus/1.0 (https://mahlzeit.app)" },
      }
    );

    console.log(`[OFF] Attempt ${attempt}/${MAX_RETRIES} response status=${res.status} for barcode=${barcode}`);

    if (!res.ok) {
      console.error(`[OFF] Upstream error: HTTP ${res.status} for barcode=${barcode} (attempt ${attempt}/${MAX_RETRIES})`);
      return "upstream_error";
    }

    const json = (await res.json()) as OffApiResponse;
    console.log(`[OFF] API status=${json.status} product=${json.product?.product_name ?? "null"} for barcode=${barcode}`);
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
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    console.error(`[OFF] Fetch error for barcode=${barcode} (attempt ${attempt}/${MAX_RETRIES}): ${isAbort ? "timeout" : (err as Error).message}`);
    return "upstream_error";
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProductFromOff(barcode: string): Promise<OffResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await singleFetch(barcode, attempt);

    if (result !== "upstream_error") return result;

    if (attempt < MAX_RETRIES) {
      console.log(`[OFF] Retry ${attempt}/${MAX_RETRIES} for barcode=${barcode}, waiting ${RETRY_DELAY_MS}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.error(`[OFF] All ${MAX_RETRIES} attempts failed for barcode=${barcode}`);
  return "upstream_error";
}
