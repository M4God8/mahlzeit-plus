import { db } from "@workspace/db";
import {
  mealFeedbackTable,
  recipesTable,
  userLearnedPreferencesTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";

const WINDOW_WEEKS = 4;
const REPLACEMENT_THRESHOLD = 2;

export interface AggregateResult {
  avgPreferredPrepTime: number | null;
  frequentlyReplacedRecipeIds: number[];
  preferredMealComplexity: "simple" | "varied" | "mixed";
  insightMessage: string | null;
}

function buildInsightMessage(result: AggregateResult): string | null {
  const messages: string[] = [];

  if (result.avgPreferredPrepTime !== null) {
    if (result.avgPreferredPrepTime <= 25) {
      messages.push(`Du bevorzugst schnelle Mahlzeiten (Ø ${result.avgPreferredPrepTime} Min.) — soll ich den Plan vereinfachen?`);
    } else if (result.avgPreferredPrepTime >= 45) {
      messages.push(`Du kochst gerne aufwendig (Ø ${result.avgPreferredPrepTime} Min.) — soll ich mehr anspruchsvolle Rezepte vorschlagen?`);
    }
  }

  if (result.frequentlyReplacedRecipeIds.length >= 2) {
    messages.push(`${result.frequentlyReplacedRecipeIds.length} Rezepte werden häufig abgelehnt — ich berücksichtige das bei neuen Vorschlägen.`);
  }

  if (result.preferredMealComplexity === "simple") {
    messages.push("Dein Essmuster: Du magst es einfach und schnell.");
  } else if (result.preferredMealComplexity === "varied") {
    messages.push("Dein Essmuster: Du genießt abwechslungsreiche und aufwendige Mahlzeiten.");
  }

  if (messages.length === 0) return null;
  return messages[0]!;
}

export async function aggregateUserPreferences(userId: string): Promise<AggregateResult> {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_WEEKS * 7);

  const rows = await db
    .select({
      recipeId: mealFeedbackTable.recipeId,
      rating: mealFeedbackTable.rating,
      prepTime: recipesTable.prepTime,
      cookTime: recipesTable.cookTime,
    })
    .from(mealFeedbackTable)
    .leftJoin(recipesTable, eq(mealFeedbackTable.recipeId, recipesTable.id))
    .where(
      and(
        eq(mealFeedbackTable.userId, userId),
        gte(mealFeedbackTable.createdAt, since)
      )
    );

  if (rows.length === 0) {
    return {
      avgPreferredPrepTime: null,
      frequentlyReplacedRecipeIds: [],
      preferredMealComplexity: "mixed",
      insightMessage: null,
    };
  }

  const likedRows = rows.filter((r) => r.rating === "thumbs_up" && r.prepTime !== null && r.cookTime !== null);
  const avgPreferredPrepTime = likedRows.length > 0
    ? Math.round(likedRows.reduce((sum, r) => sum + (r.prepTime ?? 0) + (r.cookTime ?? 0), 0) / likedRows.length)
    : null;

  const dislikedCounts: Record<number, number> = {};
  for (const r of rows) {
    if (r.rating === "thumbs_down" && r.recipeId !== null) {
      dislikedCounts[r.recipeId!] = (dislikedCounts[r.recipeId!] ?? 0) + 1;
    }
  }
  const frequentlyReplacedRecipeIds = Object.entries(dislikedCounts)
    .filter(([, count]) => count >= REPLACEMENT_THRESHOLD)
    .map(([id]) => Number(id));

  let preferredMealComplexity: "simple" | "varied" | "mixed" = "mixed";
  if (avgPreferredPrepTime !== null) {
    if (avgPreferredPrepTime <= 25) {
      preferredMealComplexity = "simple";
    } else if (avgPreferredPrepTime >= 45) {
      preferredMealComplexity = "varied";
    }
  }

  const result: AggregateResult = {
    avgPreferredPrepTime,
    frequentlyReplacedRecipeIds,
    preferredMealComplexity,
    insightMessage: null,
  };
  result.insightMessage = buildInsightMessage(result);

  await db
    .insert(userLearnedPreferencesTable)
    .values({
      userId,
      avgPreferredPrepTime,
      frequentlyReplacedRecipeIds,
      preferredMealComplexity,
      insightMessage: result.insightMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userLearnedPreferencesTable.userId,
      set: {
        avgPreferredPrepTime,
        frequentlyReplacedRecipeIds,
        preferredMealComplexity,
        insightMessage: result.insightMessage,
        updatedAt: new Date(),
      },
    });

  return result;
}
