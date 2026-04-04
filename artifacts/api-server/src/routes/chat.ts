import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  db,
  chatSessionsTable,
  shoppingListsTable,
  shoppingListItemsTable,
  mealPlansTable,
  mealPlanDaysTable,
  mealEntriesTable,
  recipesTable,
  userSettingsTable,
  nutritionProfilesTable,
} from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router = Router();

const MODEL = "claude-sonnet-4-6";
const CHAT_MAX_TOKENS = 1024;

const chatMessageBody = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional().default([]),
});

interface PlanDayContext {
  dayNumber: number;
  meals: { mealType: string; recipeTitle: string | null; customNote: string | null }[];
}

interface ChatUserContext {
  householdSize: number;
  budgetLevel: string;
  bioPreferred: boolean;
  profileNames: string[];
  excludedIngredients: string[];
  activeShoppingListTitle: string | null;
  activeShoppingListId: number | null;
  shoppingListItems: string[];
  activePlanTitle: string | null;
  activePlanId: number | null;
  activePlanDays: number;
  planDayDetails: PlanDayContext[];
}

async function getChatUserContext(userId: string): Promise<ChatUserContext> {
  const [[settings], [activeList], [activePlan]] = await Promise.all([
    db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)),
    db.select().from(shoppingListsTable)
      .where(and(eq(shoppingListsTable.userId, userId), eq(shoppingListsTable.isArchived, false)))
      .orderBy(desc(shoppingListsTable.createdAt))
      .limit(1),
    db.select().from(mealPlansTable)
      .where(and(eq(mealPlansTable.userId, userId), eq(mealPlansTable.active, true)))
      .limit(1),
  ]);

  let profileNames: string[] = [];
  let excludedIngredients: string[] = [];

  if (settings && settings.activeProfileIds.length > 0) {
    const profiles = await db.select().from(nutritionProfilesTable)
      .where(inArray(nutritionProfilesTable.id, settings.activeProfileIds));
    profileNames = profiles.map(p => p.name);
    excludedIngredients = [...new Set(profiles.flatMap(p => p.excludedIngredients))];
  }

  let shoppingListItems: string[] = [];
  if (activeList) {
    const items = await db.select({ name: shoppingListItemsTable.name })
      .from(shoppingListItemsTable)
      .where(eq(shoppingListItemsTable.shoppingListId, activeList.id));
    shoppingListItems = items.map(i => i.name);
  }

  let planDayDetails: PlanDayContext[] = [];
  if (activePlan) {
    const days = await db.select().from(mealPlanDaysTable)
      .where(eq(mealPlanDaysTable.mealPlanId, activePlan.id));

    planDayDetails = await Promise.all(
      days.map(async (day) => {
        const entries = await db
          .select({
            mealType: mealEntriesTable.mealType,
            recipeTitle: recipesTable.title,
            customNote: mealEntriesTable.customNote,
          })
          .from(mealEntriesTable)
          .leftJoin(recipesTable, eq(mealEntriesTable.recipeId, recipesTable.id))
          .where(eq(mealEntriesTable.mealPlanDayId, day.id));

        return {
          dayNumber: day.dayNumber,
          meals: entries.map(e => ({
            mealType: e.mealType,
            recipeTitle: e.recipeTitle ?? null,
            customNote: e.customNote ?? null,
          })),
        };
      })
    );
    planDayDetails.sort((a, b) => a.dayNumber - b.dayNumber);
  }

  return {
    householdSize: settings?.householdSize ?? 2,
    budgetLevel: settings?.budgetLevel ?? "medium",
    bioPreferred: settings?.bioPreferred ?? false,
    profileNames,
    excludedIngredients,
    activeShoppingListTitle: activeList?.title ?? null,
    activeShoppingListId: activeList?.id ?? null,
    shoppingListItems,
    activePlanTitle: activePlan?.title ?? null,
    activePlanId: activePlan?.id ?? null,
    activePlanDays: activePlan?.cycleLengthDays ?? 7,
    planDayDetails,
  };
}

function buildChatSystemPrompt(ctx: ChatUserContext): string {
  const contextLines: string[] = [];
  contextLines.push(`Haushaltsgröße: ${ctx.householdSize} Person(en)`);
  contextLines.push(`Budget: ${ctx.budgetLevel === "low" ? "sparsam" : ctx.budgetLevel === "high" ? "großzügig" : "mittel"}`);
  if (ctx.bioPreferred) contextLines.push("Bio-Produkte werden bevorzugt.");
  if (ctx.profileNames.length > 0) contextLines.push(`Ernährungsprofil: ${ctx.profileNames.join(", ")}`);
  if (ctx.excludedIngredients.length > 0) contextLines.push(`Ausgeschlossene Zutaten: ${ctx.excludedIngredients.join(", ")}`);
  if (ctx.activeShoppingListTitle) {
    contextLines.push(`Aktive Einkaufsliste: "${ctx.activeShoppingListTitle}" (${ctx.shoppingListItems.length} Artikel)`);
    if (ctx.shoppingListItems.length > 0) {
      contextLines.push(`Artikel auf der Liste: ${ctx.shoppingListItems.join(", ")}`);
    }
  } else {
    contextLines.push("Keine aktive Einkaufsliste vorhanden.");
  }
  if (ctx.activePlanTitle) {
    contextLines.push(`Aktiver Wochenplan: "${ctx.activePlanTitle}" (${ctx.activePlanDays} Tage)`);
    if (ctx.planDayDetails.length > 0) {
      const filledDays = ctx.planDayDetails.filter(d => d.meals.length > 0);
      if (filledDays.length > 0) {
        contextLines.push("Mahlzeiten im aktuellen Plan:");
        for (const day of filledDays) {
          const mealDescriptions = day.meals.map(m => {
            const label = m.recipeTitle ?? m.customNote ?? "leer";
            return `${m.mealType}: ${label}`;
          });
          contextLines.push(`  Tag ${day.dayNumber}: ${mealDescriptions.join(", ")}`);
        }
      } else {
        contextLines.push("Der Wochenplan hat noch keine Mahlzeiten eingetragen.");
      }
    }
  } else {
    contextLines.push("Kein aktiver Wochenplan vorhanden.");
  }

  return `Du bist der "Bewusste Begleiter" — ein warmherziger, alltagsnaher Ernährungs-Coach in der Mahlzeit+ App. 
Du sprichst Deutsch, duzt den Nutzer, und antwortest in maximal 3-4 kurzen Sätzen.
Sei ermutigend und pragmatisch, nicht belehrend.

NUTZERKONTEXT:
${contextLines.join("\n")}

WICHTIGE REGELN:
1. Antworte IMMER als gültiges JSON mit genau diesem Format:
{
  "text": "Deine Antwort hier",
  "suggested_action": null
}

2. Du kannst dem Nutzer vorschlagen, Items zur Einkaufsliste hinzuzufügen oder einen neuen Wochenplan zu erstellen.
   Wenn du eine Aktion vorschlägst, setze "suggested_action" so:

   Für Einkaufslisten-Item:
   {
     "text": "Deine Antwort hier",
     "suggested_action": {
       "type": "add_to_shopping_list",
       "data": { "items": ["Zutat1", "Zutat2"] },
       "confirmation_text": "Zur Einkaufsliste hinzufügen"
     }
   }

   Für Wochenplan erstellen:
   {
     "text": "Deine Antwort hier", 
     "suggested_action": {
       "type": "create_plan",
       "data": { "title": "Plantitel", "days": 7 },
       "confirmation_text": "Wochenplan erstellen"
     }
   }

   Für Rezept-Vorschlag (nur als Hinweis, wird nicht direkt erstellt):
   {
     "text": "Deine Antwort hier",
     "suggested_action": {
       "type": "add_recipe",
       "data": { "title": "Rezeptname", "description": "Kurzbeschreibung" },
       "confirmation_text": "Rezept vormerken"
     }
   }

3. Schlage NUR dann eine Aktion vor, wenn der Nutzer explizit danach fragt oder es sich klar aus dem Gespräch ergibt.
4. Verwende NIEMALS ausgeschlossene Zutaten in Vorschlägen.
5. Antworte NUR mit dem JSON-Objekt, kein Markdown, kein Extra-Text.`;
}

const chatResponseSchema = z.object({
  text: z.string(),
  suggested_action: z.object({
    type: z.enum(["add_to_shopping_list", "create_plan", "add_recipe"]),
    data: z.record(z.unknown()),
    confirmation_text: z.string(),
  }).nullable().optional(),
});

router.post("/chat/message", requireAuth, async (req, res) => {
  try {
    const parsed = chatMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Nachricht", details: parsed.error.flatten() });
      return;
    }

    const userId = req.userId!;
    const { message, history } = parsed.data;

    const ctx = await getChatUserContext(userId);
    const systemPrompt = buildChatSystemPrompt(ctx);

    const historyMessages = history.slice(-10).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const lastIsCurrentMessage = historyMessages.length > 0
      && historyMessages[historyMessages.length - 1]!.role === "user"
      && historyMessages[historyMessages.length - 1]!.content === message;
    const conversationMessages = lastIsCurrentMessage
      ? historyMessages
      : [...historyMessages, { role: "user" as const, content: message }];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    const rawText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    let replyText = "Entschuldigung, ich konnte deine Nachricht gerade nicht verarbeiten. Versuch es bitte nochmal!";
    let suggestedAction: { type: string; data: Record<string, unknown>; confirmation_text: string } | null = null;

    try {
      const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const candidate = codeBlock ? codeBlock[1]!.trim() : rawText.trim();
      const jsonParsed = JSON.parse(candidate);
      const validated = chatResponseSchema.parse(jsonParsed);
      replyText = validated.text;
      suggestedAction = validated.suggested_action ?? null;
    } catch {
      if (rawText.trim().length > 0) {
        replyText = rawText.trim().replace(/^["']|["']$/g, "");
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaySession] = await db
      .select()
      .from(chatSessionsTable)
      .where(
        and(
          eq(chatSessionsTable.userId, userId),
          gte(chatSessionsTable.createdAt, todayStart),
        )
      )
      .orderBy(desc(chatSessionsTable.createdAt))
      .limit(1);

    const totalTokens = inputTokens + outputTokens;

    if (todaySession) {
      await db
        .update(chatSessionsTable)
        .set({
          messageCount: todaySession.messageCount + 1,
          totalTokens: todaySession.totalTokens + totalTokens,
        })
        .where(eq(chatSessionsTable.id, todaySession.id));
    } else {
      await db.insert(chatSessionsTable).values({
        userId,
        messageCount: 1,
        totalTokens,
      });
    }

    const result: Record<string, unknown> = { reply: replyText };
    if (suggestedAction) {
      result.suggested_action = suggestedAction;
    }

    res.json(result);
  } catch (err) {
    req.log?.error?.({ err }, "Failed to process chat message");
    res.status(500).json({ error: "Internal server error" });
  }
});

const confirmActionBody = z.object({
  action_type: z.enum(["add_to_shopping_list", "create_plan", "add_recipe"]),
  data: z.record(z.unknown()),
});

router.post("/chat/confirm-action", requireAuth, async (req, res) => {
  try {
    const parsed = confirmActionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ungültige Aktion", details: parsed.error.flatten() });
      return;
    }

    const userId = req.userId!;
    const { action_type, data } = parsed.data;

    if (action_type === "add_to_shopping_list") {
      const items = z.array(z.string().min(1).max(200)).min(1).max(20).safeParse(data.items);
      if (!items.success) {
        res.status(400).json({ error: "Ungültige Items (max. 20 Artikel, jeweils max. 200 Zeichen)" });
        return;
      }

      const [activeList] = await db.select().from(shoppingListsTable)
        .where(and(eq(shoppingListsTable.userId, userId), eq(shoppingListsTable.isArchived, false)))
        .orderBy(desc(shoppingListsTable.createdAt))
        .limit(1);

      if (!activeList) {
        res.status(404).json({ error: "Keine aktive Einkaufsliste gefunden. Erstelle zuerst eine Einkaufsliste." });
        return;
      }

      const inserted = [];
      for (const itemName of items.data) {
        const [item] = await db.insert(shoppingListItemsTable).values({
          shoppingListId: activeList.id,
          name: itemName,
          amount: null,
          unit: null,
          category: "Sonstiges",
          isChecked: false,
          bioRecommended: false,
          isManual: true,
          ingredientId: null,
        }).returning();
        inserted.push(item);
      }

      res.json({
        success: true,
        message: `${inserted.length} Artikel zur Einkaufsliste "${activeList.title}" hinzugefügt.`,
      });
      return;
    }

    if (action_type === "create_plan") {
      const planData = z.object({
        title: z.string().min(1).max(200),
        days: z.number().int().min(1).max(30).default(7),
      }).safeParse(data);

      if (!planData.success) {
        res.status(400).json({ error: "Ungültige Plan-Daten" });
        return;
      }

      const [plan] = await db.insert(mealPlansTable).values({
        userId,
        title: planData.data.title,
        cycleLengthDays: planData.data.days,
        repeatEnabled: true,
        active: false,
      }).returning();

      const dayRows: { mealPlanId: number; dayNumber: number }[] = [];
      for (let i = 1; i <= planData.data.days; i++) {
        dayRows.push({ mealPlanId: plan.id, dayNumber: i });
      }
      await db.insert(mealPlanDaysTable).values(dayRows);

      res.json({
        success: true,
        message: `Wochenplan "${plan.title}" mit ${planData.data.days} Tagen erstellt. Du kannst ihn jetzt mit Rezepten füllen!`,
        planId: plan.id,
      });
      return;
    }

    if (action_type === "add_recipe") {
      const recipeData = z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
      }).safeParse(data);

      if (!recipeData.success) {
        res.status(400).json({ error: "Ungültige Rezept-Daten" });
        return;
      }

      res.json({
        success: true,
        message: `Rezeptidee "${recipeData.data.title}" vorgemerkt! Du kannst es über die KI-Rezepterstellung anlegen.`,
      });
      return;
    }

    res.status(400).json({ error: "Unbekannte Aktion" });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to confirm chat action");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
