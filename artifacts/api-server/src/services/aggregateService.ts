import { db } from "@workspace/db";
import {
  mealFeedbackTable,
  recipesTable,
  userLearnedPreferencesTable,
} from "@workspace/db";
import { eq, and, gte, ne } from "drizzle-orm";
import type { UserLearnedPreferences } from "@workspace/db";

const WINDOW_WEEKS = 4;
const REPLACEMENT_THRESHOLD = 2;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

function buildInsightMessage(
  avgPreferredPrepTime: number | null,
  preferredMealComplexity: string,
  replacedCount: number
): string | null {
  const messages: string[] = [];

  if (avgPreferredPrepTime !== null) {
    if (avgPreferredPrepTime <= 25) {
      messages.push(
        `Du bevorzugst schnelle Mahlzeiten (Ø ${avgPreferredPrepTime} Min.) — soll ich den Plan vereinfachen?`
      );
    } else if (avgPreferredPrepTime >= 45) {
      messages.push(
        `Du kochst gerne aufwendig (Ø ${avgPreferredPrepTime} Min.) — soll ich mehr anspruchsvolle Rezepte vorschlagen?`
      );
    }
  }

  if (replacedCount >= 2) {
    messages.push(
      `${replacedCount} Rezepte werden häufig abgelehnt — ich berücksichtige das bei neuen Vorschlägen.`
    );
  }

  if (messages.length === 0) {
    if (preferredMealComplexity === "simple") {
      messages.push("Dein Essmuster: Du magst es einfach und schnell.");
    } else if (preferredMealComplexity === "varied") {
      messages.push("Dein Essmuster: Du genießt abwechslungsreiche und aufwendige Mahlzeiten.");
    }
  }

  return messages.length > 0 ? messages[0]! : null;
}

export async function aggregateUserPreferences(userId: string): Promise<UserLearnedPreferences> {
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

  const likedRows = rows.filter(
    (r) => r.rating === "thumbs_up" && r.prepTime !== null && r.cookTime !== null
  );

  const prepTimesLiked = likedRows.map((r) => (r.prepTime ?? 0) + (r.cookTime ?? 0));
  const avgPreferredPrepTime = median(prepTimesLiked);

  const dislikedCounts: Record<number, number> = {};
  for (const r of rows) {
    if (r.rating === "thumbs_down" && r.recipeId !== null) {
      dislikedCounts[r.recipeId!] = (dislikedCounts[r.recipeId!] ?? 0) + 1;
    }
  }
  const frequentlyReplacedRecipeIds = Object.entries(dislikedCounts)
    .filter(([, count]) => count >= REPLACEMENT_THRESHOLD)
    .map(([id]) => Number(id));

  const simpleCount = likedRows.filter((r) => (r.prepTime ?? 0) + (r.cookTime ?? 0) <= 25).length;
  const complexCount = likedRows.filter((r) => (r.prepTime ?? 0) + (r.cookTime ?? 0) >= 45).length;
  let preferredMealComplexity: "simple" | "varied" | "mixed" = "mixed";
  if (likedRows.length > 0) {
    const simpleRatio = simpleCount / likedRows.length;
    const complexRatio = complexCount / likedRows.length;
    if (simpleRatio > 0.5) {
      preferredMealComplexity = "simple";
    } else if (complexRatio > 0.5) {
      preferredMealComplexity = "varied";
    }
  }

  const insightMessage = buildInsightMessage(
    avgPreferredPrepTime,
    preferredMealComplexity,
    frequentlyReplacedRecipeIds.length
  );

  const [upserted] = await db
    .insert(userLearnedPreferencesTable)
    .values({
      userId,
      avgPreferredPrepTime,
      frequentlyReplacedRecipeIds,
      preferredMealComplexity,
      insightMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userLearnedPreferencesTable.userId,
      set: {
        avgPreferredPrepTime,
        frequentlyReplacedRecipeIds,
        preferredMealComplexity,
        insightMessage,
        updatedAt: new Date(),
      },
    })
    .returning();

  return upserted!;
}
