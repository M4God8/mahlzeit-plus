export interface UpcProduct {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl: string;
  description: string;
  ingredients: string;
}

interface UpcApiItem {
  title?: string;
  brand?: string;
  images?: string[];
  description?: string;
}

interface UpcApiResponse {
  code: string;
  total: number;
  items?: UpcApiItem[];
}

const UPC_BASE = "https://api.upcitemdb.com/prod/trial/lookup";
const TIMEOUT_MS = 6000;

export type UpcResult = UpcProduct | null | "upstream_error";

export async function fetchProductFromUpc(barcode: string): Promise<UpcResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `${UPC_BASE}?upc=${encodeURIComponent(barcode)}`;

  console.log(`[UPC] Fetching barcode=${barcode} url=${url}`);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MahlzeitPlus/1.0 (https://mahlzeit.app)" },
    });

    console.log(`[UPC] Response status=${res.status} for barcode=${barcode}`);

    if (res.status === 404) {
      console.log(`[UPC] Product not found (404) for barcode=${barcode}`);
      return null;
    }

    if (res.status === 429) {
      console.warn(`[UPC] Rate limited (429) for barcode=${barcode}`);
      return "upstream_error";
    }

    if (res.status >= 500) {
      console.error(`[UPC] Server error: HTTP ${res.status} for barcode=${barcode}`);
      return "upstream_error";
    }

    if (!res.ok) {
      console.warn(`[UPC] Client error: HTTP ${res.status} for barcode=${barcode} — not retrying`);
      return null;
    }

    const json = (await res.json()) as UpcApiResponse;
    console.log(`[UPC] API code=${json.code} total=${json.total} for barcode=${barcode}`);

    if (json.code !== "OK" || !json.items || json.items.length === 0) {
      console.log(`[UPC] No items found for barcode=${barcode}`);
      return null;
    }

    const item = json.items[0];

    return {
      barcode,
      productName: item.title ?? "",
      brand: item.brand ?? "",
      imageUrl: item.images?.[0] ?? "",
      description: item.description ?? "",
      ingredients: "",
    };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    console.error(`[UPC] Fetch error for barcode=${barcode}: ${isAbort ? "timeout" : (err as Error).message}`);
    return "upstream_error";
  } finally {
    clearTimeout(timer);
  }
}
