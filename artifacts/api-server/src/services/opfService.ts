export interface OpfProduct {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl: string;
  ingredients: string;
  labels: string[];
  categories: string[];
}

interface OpfApiProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  ingredients_text?: string;
  labels?: string;
  labels_tags?: string[];
  categories?: string;
  categories_tags?: string[];
}

interface OpfApiResponse {
  status: number;
  product?: OpfApiProduct;
}

const OPF_BASE = "https://world.openproductsfacts.org/api/v2/product";
const TIMEOUT_MS = 6000;

export type OpfResult = OpfProduct | null | "upstream_error";

export async function fetchProductFromOpf(barcode: string): Promise<OpfResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `${OPF_BASE}/${encodeURIComponent(barcode)}?fields=product_name,brands,image_url,ingredients_text,labels,labels_tags,categories,categories_tags`;

  console.log(`[OPF] Fetching barcode=${barcode} url=${url}`);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MahlzeitPlus/1.0 (https://mahlzeit.app)" },
    });

    console.log(`[OPF] Response status=${res.status} for barcode=${barcode}`);

    if (res.status === 404) {
      console.log(`[OPF] Product not found (404) for barcode=${barcode}`);
      return null;
    }

    if (res.status >= 500) {
      console.error(`[OPF] Server error: HTTP ${res.status} for barcode=${barcode}`);
      return "upstream_error";
    }

    if (!res.ok) {
      console.warn(`[OPF] Client error: HTTP ${res.status} for barcode=${barcode} — not retrying`);
      return null;
    }

    const json = (await res.json()) as OpfApiResponse;
    console.log(`[OPF] API status=${json.status} product=${json.product?.product_name ?? "null"} for barcode=${barcode}`);
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;

    const labels: string[] = p.labels_tags?.map((l) => l.replace(/^[a-z]{2}:/, "")) ??
      (p.labels ? p.labels.split(",").map((l) => l.trim().toLowerCase()) : []);

    const categories: string[] = p.categories_tags?.map((c) => c.replace(/^[a-z]{2}:/, "")) ??
      (p.categories ? p.categories.split(",").map((c) => c.trim().toLowerCase()) : []);

    return {
      barcode,
      productName: p.product_name ?? "",
      brand: p.brands ?? "",
      imageUrl: p.image_url ?? "",
      ingredients: p.ingredients_text ?? "",
      labels,
      categories,
    };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    console.error(`[OPF] Fetch error for barcode=${barcode}: ${isAbort ? "timeout" : (err as Error).message}`);
    return "upstream_error";
  } finally {
    clearTimeout(timer);
  }
}
