import { Router } from "express";
import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  shoppingListsTable,
  shoppingListItemsTable,
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipeIngredientsTable,
  ingredientsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { ShoppingList, ShoppingListItem, MealEntry } from "@workspace/db";

const router = Router();

const INGREDIENT_CATEGORY_MAP: Record<string, string> = {
  "Gemüse": "Gemüse & Obst",
  "Obst": "Gemüse & Obst",
  "Fleisch": "Protein",
  "Fisch": "Protein",
  "Hülsenfrüchte": "Protein",
  "Eier": "Protein",
  "Getreide": "Getreide & Brot",
  "Brot": "Getreide & Brot",
  "Pasta": "Getreide & Brot",
  "Reis": "Getreide & Brot",
  "Milchprodukte": "Milchprodukte",
  "Käse": "Milchprodukte",
  "Gewürze": "Gewürze & Öle",
  "Öle": "Gewürze & Öle",
  "Kräuter": "Gewürze & Öle",
};

function mapCategory(raw: string): string {
  return INGREDIENT_CATEGORY_MAP[raw] ?? "Sonstiges";
}

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

function tryParseAmount(amount: string): number | null {
  const n = parseFloat(amount.replace(",", "."));
  return isNaN(n) ? null : n;
}

function convertToBase(amount: number, unit: string): { amount: number; unit: string } | null {
  const u = normalizeUnit(unit);
  if (u === "kg") return { amount: amount * 1000, unit: "g" };
  if (u === "l") return { amount: amount * 1000, unit: "ml" };
  return null;
}

function formatAmount(n: number, unit: string): string {
  const u = normalizeUnit(unit);
  if (u === "g" && n >= 1000) return String(+(n / 1000).toFixed(2));
  if (u === "ml" && n >= 1000) return String(+(n / 1000).toFixed(2));
  return String(Math.round(n * 100) / 100);
}

function mergeUnit(u: string): string {
  const norm = normalizeUnit(u);
  if (norm === "kg") return "g";
  if (norm === "l") return "ml";
  return norm;
}

function formatSummary(list: ShoppingList, itemCount: number, checkedCount: number) {
  return {
    id: list.id,
    userId: list.userId,
    title: list.title,
    weekFrom: list.weekFrom,
    weekTo: list.weekTo,
    isArchived: list.isArchived,
    mealPlanId: list.mealPlanId,
    createdAt: list.createdAt instanceof Date ? list.createdAt.toISOString() : String(list.createdAt),
    itemCount,
    checkedCount,
  };
}

function formatList(list: ShoppingList, items: ShoppingListItem[]) {
  return {
    id: list.id,
    userId: list.userId,
    title: list.title,
    weekFrom: list.weekFrom,
    weekTo: list.weekTo,
    isArchived: list.isArchived,
    mealPlanId: list.mealPlanId,
    createdAt: list.createdAt instanceof Date ? list.createdAt.toISOString() : String(list.createdAt),
    items,
  };
}

router.get("/shopping-lists", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const lists = await db
      .select()
      .from(shoppingListsTable)
      .where(eq(shoppingListsTable.userId, userId))
      .orderBy(desc(shoppingListsTable.createdAt));

    const summaries = await Promise.all(
      lists.map(async (list) => {
        const items = await db
          .select()
          .from(shoppingListItemsTable)
          .where(eq(shoppingListItemsTable.shoppingListId, list.id));
        return formatSummary(list, items.length, items.filter((i) => i.isChecked).length);
      })
    );
    res.json(summaries);
  } catch (err) {
    req.log.error({ err }, "Failed to list shopping lists");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shopping-lists/generate", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const [activePlan] = await db
      .select()
      .from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)));

    if (!activePlan) {
      res.status(404).json({ error: "Kein aktiver Mahlzeitenplan gefunden" });
      return;
    }

    const days = await db
      .select()
      .from(mealPlanDaysTable)
      .where(eq(mealPlanDaysTable.mealPlanId, activePlan.id));

    const dayIds = days.map((d) => d.id);
    const entries: MealEntry[] = dayIds.length > 0
      ? await db
          .select()
          .from(mealEntriesTable)
          .where(inArray(mealEntriesTable.mealPlanDayId, dayIds))
      : [];

    const recipeIds = [...new Set(
      entries
        .map((e) => e.recipeId)
        .filter((id): id is number => id !== null)
    )];

    type MergedItem = {
      name: string;
      totalAmount: number | null;
      unit: string;
      category: string;
      bioRecommended: boolean;
      ingredientId: number | null;
      hasNumericAmount: boolean;
      rawAmounts: string[];
    };

    const mergedMap = new Map<string, MergedItem>();

    for (const recipeId of recipeIds) {
      const ingredients = await db
        .select({
          id: recipeIngredientsTable.id,
          ingredientId: recipeIngredientsTable.ingredientId,
          customName: recipeIngredientsTable.customName,
          amount: recipeIngredientsTable.amount,
          unit: recipeIngredientsTable.unit,
          optional: recipeIngredientsTable.optional,
          ingName: ingredientsTable.name,
          ingCategory: ingredientsTable.category,
          ingBio: ingredientsTable.bioRecommended,
        })
        .from(recipeIngredientsTable)
        .leftJoin(ingredientsTable, eq(recipeIngredientsTable.ingredientId, ingredientsTable.id))
        .where(eq(recipeIngredientsTable.recipeId, recipeId));

      for (const ing of ingredients) {
        if (ing.optional) continue;
        const name = ing.ingName ?? ing.customName ?? "Unbekannte Zutat";
        const baseUnit = mergeUnit(ing.unit);
        const key = `${name.toLowerCase()}__${baseUnit}`;

        const parsed = tryParseAmount(ing.amount);
        const converted = parsed !== null ? convertToBase(parsed, ing.unit) : null;
        const normalizedAmount = converted?.amount ?? parsed;
        const normalizedUnit = converted?.unit ?? baseUnit;

        const existing = mergedMap.get(key);
        if (existing) {
          if (normalizedAmount !== null && existing.hasNumericAmount) {
            existing.totalAmount = (existing.totalAmount ?? 0) + normalizedAmount;
          } else {
            existing.rawAmounts.push(ing.amount);
            existing.hasNumericAmount = false;
          }
        } else {
          mergedMap.set(key, {
            name,
            totalAmount: normalizedAmount,
            unit: normalizedUnit,
            category: mapCategory(ing.ingCategory ?? ""),
            bioRecommended: ing.ingBio ?? false,
            ingredientId: ing.ingredientId,
            hasNumericAmount: normalizedAmount !== null,
            rawAmounts: [ing.amount],
          });
        }
      }
    }

    const now = new Date();
    const weekFrom = now.toISOString().split("T")[0]!;
    const weekTo = new Date(now.getTime() + activePlan.cycleLengthDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]!;
    const title = `${activePlan.title} — ${weekFrom}`;

    const [newList] = await db
      .insert(shoppingListsTable)
      .values({ userId, title, weekFrom, weekTo, mealPlanId: activePlan.id })
      .returning();

    if (!newList) {
      res.status(500).json({ error: "Fehler beim Erstellen der Einkaufsliste" });
      return;
    }

    const itemsToInsert = Array.from(mergedMap.values()).map((item) => {
      const finalUnit = item.hasNumericAmount
        ? (item.unit === "g" && (item.totalAmount ?? 0) >= 1000 ? "kg"
          : item.unit === "ml" && (item.totalAmount ?? 0) >= 1000 ? "l"
          : item.unit)
        : item.unit;
      return {
        shoppingListId: newList.id,
        name: item.name,
        amount: item.hasNumericAmount && item.totalAmount !== null
          ? formatAmount(item.totalAmount, item.unit)
          : item.rawAmounts.join(" + "),
        unit: finalUnit,
        category: item.category,
        isChecked: false as boolean,
        bioRecommended: item.bioRecommended,
        isManual: false as boolean,
        ingredientId: item.ingredientId,
      };
    });

    const insertedItems = itemsToInsert.length > 0
      ? await db.insert(shoppingListItemsTable).values(itemsToInsert).returning()
      : [];

    res.status(201).json(formatList(newList, insertedItems));
  } catch (err) {
    req.log.error({ err }, "Failed to generate shopping list");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shopping-lists/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    if (isNaN(listId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden" }); return; }

    const items = await db
      .select()
      .from(shoppingListItemsTable)
      .where(eq(shoppingListItemsTable.shoppingListId, listId));

    res.json(formatList(list, items));
  } catch (err) {
    req.log.error({ err }, "Failed to get shopping list");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/shopping-lists/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    if (isNaN(listId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden" }); return; }

    await db.delete(shoppingListsTable).where(eq(shoppingListsTable.id, listId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete shopping list");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shopping-lists/:id/archive", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    if (isNaN(listId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden" }); return; }

    const [updated] = await db
      .update(shoppingListsTable)
      .set({ isArchived: true })
      .where(eq(shoppingListsTable.id, listId))
      .returning();

    const items = await db
      .select()
      .from(shoppingListItemsTable)
      .where(eq(shoppingListItemsTable.shoppingListId, listId));

    res.json(formatSummary(updated!, items.length, items.filter((i) => i.isChecked).length));
  } catch (err) {
    req.log.error({ err }, "Failed to archive shopping list");
    res.status(500).json({ error: "Internal server error" });
  }
});

const manualItemSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.string().optional(),
});

router.post("/shopping-lists/:id/items", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    if (isNaN(listId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const parsed = manualItemSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Ungültige Eingabe" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(404).json({ error: "Liste nicht gefunden" }); return; }

    const [item] = await db
      .insert(shoppingListItemsTable)
      .values({
        shoppingListId: listId,
        name: parsed.data.name,
        amount: parsed.data.amount ?? null,
        unit: parsed.data.unit ?? null,
        category: parsed.data.category ?? "Sonstiges",
        isChecked: false,
        bioRecommended: false,
        isManual: true,
        ingredientId: null,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to add shopping list item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/shopping-lists/:id/items/:itemId/toggle", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    const itemId = parseInt(req.params["itemId"] as string);
    if (isNaN(listId) || isNaN(itemId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(403).json({ error: "Zugriff verweigert" }); return; }

    const [item] = await db
      .select()
      .from(shoppingListItemsTable)
      .where(and(eq(shoppingListItemsTable.id, itemId), eq(shoppingListItemsTable.shoppingListId, listId)));
    if (!item) { res.status(404).json({ error: "Eintrag nicht gefunden" }); return; }

    const [updated] = await db
      .update(shoppingListItemsTable)
      .set({ isChecked: !item.isChecked })
      .where(eq(shoppingListItemsTable.id, itemId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to toggle shopping list item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/shopping-lists/:id/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const listId = parseInt(req.params["id"] as string);
    const itemId = parseInt(req.params["itemId"] as string);
    if (isNaN(listId) || isNaN(itemId)) { res.status(400).json({ error: "Ungültige ID" }); return; }

    const [list] = await db
      .select()
      .from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.id, listId), eq(shoppingListsTable.userId, userId)));
    if (!list) { res.status(403).json({ error: "Zugriff verweigert" }); return; }

    const [item] = await db
      .select()
      .from(shoppingListItemsTable)
      .where(and(eq(shoppingListItemsTable.id, itemId), eq(shoppingListItemsTable.shoppingListId, listId)));
    if (!item) { res.status(404).json({ error: "Eintrag nicht gefunden" }); return; }

    if (!item.isManual) {
      res.status(400).json({ error: "Nur manuell hinzugefügte Einträge können gelöscht werden" });
      return;
    }

    await db.delete(shoppingListItemsTable).where(eq(shoppingListItemsTable.id, itemId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete shopping list item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
