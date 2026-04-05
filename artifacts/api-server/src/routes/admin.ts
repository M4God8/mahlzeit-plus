import { Router } from "express";
import { db, userSettingsTable, aiGenerationsTable, nutritionProfilesTable } from "@workspace/db";
import { eq, sql, gte, lte, and, inArray, count, sum, isNull, type SQL } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireAuth } from "../middlewares/requireAuth";
import { pool } from "@workspace/db";
import { clerkClient } from "@clerk/express";

const router = Router();

interface AiStatsRow {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
}

interface HealthCheck {
  status: string;
  latencyMs?: number;
  error?: string;
}

router.get("/admin/role-check", requireAuth, async (req, res) => {
  const [row] = await db
    .select({ role: userSettingsTable.role })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId!));
  res.json({ role: row?.role ?? "user" });
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const [totalUsers] = await db
      .select({ count: count() })
      .from(userSettingsTable);

    const [premiumUsers] = await db
      .select({ count: count() })
      .from(userSettingsTable)
      .where(gte(userSettingsTable.premiumUntil, new Date()));

    const [newToday] = await db
      .select({ count: count() })
      .from(userSettingsTable)
      .where(gte(userSettingsTable.createdAt, todayStart));

    const [newWeek] = await db
      .select({ count: count() })
      .from(userSettingsTable)
      .where(gte(userSettingsTable.createdAt, weekStart));

    const [newMonth] = await db
      .select({ count: count() })
      .from(userSettingsTable)
      .where(gte(userSettingsTable.createdAt, monthStart));

    const [totalCost] = await db
      .select({ total: sum(aiGenerationsTable.costEur) })
      .from(aiGenerationsTable);

    const [totalAiCalls] = await db
      .select({ count: count() })
      .from(aiGenerationsTable);

    res.json({
      totalUsers: totalUsers!.count,
      premiumUsers: premiumUsers!.count,
      newUsersToday: newToday!.count,
      newUsersWeek: newWeek!.count,
      newUsersMonth: newMonth!.count,
      mrr: 0,
      mrrNote: "Stripe nicht integriert",
      totalAiCostEur: parseFloat(totalCost!.total ?? "0"),
      totalAiCalls: totalAiCalls!.count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const { profile, plan, periodDays, aiUsage } = req.query;

    const conditions: SQL[] = [];

    if (plan === "premium") {
      conditions.push(gte(userSettingsTable.premiumUntil, new Date()));
    } else if (plan === "free") {
      conditions.push(
        sql`(${userSettingsTable.premiumUntil} IS NULL OR ${userSettingsTable.premiumUntil} < NOW())`
      );
    }

    if (periodDays) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(periodDays));
      conditions.push(gte(userSettingsTable.createdAt, daysAgo));
    }

    const users = await db
      .select()
      .from(userSettingsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const userIds = users.map((u) => u.userId);

    const aiStats: Record<string, AiStatsRow> = {};

    if (userIds.length > 0) {
      const aiRows = await db
        .select({
          userId: aiGenerationsTable.userId,
          calls: count(),
          inputTokens: sum(aiGenerationsTable.inputTokens),
          outputTokens: sum(aiGenerationsTable.outputTokens),
          costEur: sum(aiGenerationsTable.costEur),
        })
        .from(aiGenerationsTable)
        .where(inArray(aiGenerationsTable.userId, userIds))
        .groupBy(aiGenerationsTable.userId);

      for (const row of aiRows) {
        aiStats[row.userId] = {
          calls: row.calls,
          inputTokens: parseInt(String(row.inputTokens ?? "0")),
          outputTokens: parseInt(String(row.outputTokens ?? "0")),
          costEur: parseFloat(String(row.costEur ?? "0")),
        };
      }
    }

    const profileMap: Record<number, string> = {};
    const allProfileIds = [...new Set(users.flatMap((u) => u.activeProfileIds))];
    if (allProfileIds.length > 0) {
      const profiles = await db
        .select({ id: nutritionProfilesTable.id, name: nutritionProfilesTable.name })
        .from(nutritionProfilesTable)
        .where(inArray(nutritionProfilesTable.id, allProfileIds));
      for (const p of profiles) {
        profileMap[p.id] = p.name;
      }
    }

    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      try {
        const batchSize = 100;
        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);
          const clerkUsers = await clerkClient.users.getUserList({
            userId: batch,
            limit: batchSize,
          });
          for (const cu of clerkUsers.data) {
            emailMap[cu.id] = cu.emailAddresses?.[0]?.emailAddress ?? "";
          }
        }
      } catch (err) {
        req.log.warn({ err }, "Failed to fetch emails from Clerk");
      }
    }

    let result = users.map((u) => {
      const stats = aiStats[u.userId] ?? { calls: 0, inputTokens: 0, outputTokens: 0, costEur: 0 };
      return {
        userId: u.userId,
        email: emailMap[u.userId] ?? "",
        role: u.role,
        isPremium: u.premiumUntil ? new Date(u.premiumUntil) > new Date() : false,
        premiumExpiresAt: u.premiumUntil,
        isBlocked: u.isBlocked,
        createdAt: u.createdAt,
        householdSize: u.householdSize,
        budgetLevel: u.budgetLevel,
        profiles: u.activeProfileIds.map((id) => profileMap[id] ?? `ID ${id}`),
        aiCalls: stats.calls,
        aiInputTokens: stats.inputTokens,
        aiOutputTokens: stats.outputTokens,
        aiCostEur: stats.costEur,
      };
    });

    if (profile) {
      result = result.filter((u) =>
        u.profiles.some((p) => p.toLowerCase().includes(String(profile).toLowerCase()))
      );
    }

    if (aiUsage === "high") {
      result = result.filter((u) => u.aiCostEur > 1.0);
    } else if (aiUsage === "medium") {
      result = result.filter((u) => u.aiCostEur > 0.1 && u.aiCostEur <= 1.0);
    } else if (aiUsage === "low") {
      result = result.filter((u) => u.aiCostEur <= 0.1);
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get admin users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/costs", requireAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, userId, aiType, groupBy } = req.query;

    const conditions: SQL[] = [];

    if (dateFrom) {
      conditions.push(gte(aiGenerationsTable.createdAt, new Date(String(dateFrom))));
    }
    if (dateTo) {
      conditions.push(lte(aiGenerationsTable.createdAt, new Date(String(dateTo))));
    }
    if (userId) {
      conditions.push(eq(aiGenerationsTable.userId, String(userId)));
    }
    if (aiType) {
      conditions.push(eq(aiGenerationsTable.type, String(aiType)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const byType = await db
      .select({
        type: aiGenerationsTable.type,
        calls: count(),
        totalInputTokens: sum(aiGenerationsTable.inputTokens),
        totalOutputTokens: sum(aiGenerationsTable.outputTokens),
        totalCostEur: sum(aiGenerationsTable.costEur),
      })
      .from(aiGenerationsTable)
      .where(whereClause)
      .groupBy(aiGenerationsTable.type);

    const byUser = await db
      .select({
        userId: aiGenerationsTable.userId,
        calls: count(),
        totalCostEur: sum(aiGenerationsTable.costEur),
      })
      .from(aiGenerationsTable)
      .where(whereClause)
      .groupBy(aiGenerationsTable.userId)
      .orderBy(sql`sum(${aiGenerationsTable.costEur}) desc nulls last`);

    const groupMode = String(groupBy ?? "day");

    let dateExpr: SQL<string>;
    if (groupMode === "week") {
      dateExpr = sql<string>`to_char(date_trunc('week', ${aiGenerationsTable.createdAt}), 'YYYY-MM-DD')`;
    } else if (groupMode === "month") {
      dateExpr = sql<string>`to_char(date_trunc('month', ${aiGenerationsTable.createdAt}), 'YYYY-MM-DD')`;
    } else {
      dateExpr = sql<string>`to_char(date(${aiGenerationsTable.createdAt}), 'YYYY-MM-DD')`;
    }

    const groupedCosts = await db
      .select({
        date: dateExpr.as("date"),
        totalCostEur: sum(aiGenerationsTable.costEur),
        calls: count(),
      })
      .from(aiGenerationsTable)
      .where(whereClause)
      .groupBy(dateExpr)
      .orderBy(dateExpr);

    const [totals] = await db
      .select({
        totalCalls: count(),
        totalCostEur: sum(aiGenerationsTable.costEur),
        totalInputTokens: sum(aiGenerationsTable.inputTokens),
        totalOutputTokens: sum(aiGenerationsTable.outputTokens),
      })
      .from(aiGenerationsTable)
      .where(whereClause);

    res.json({
      totals: {
        calls: totals!.totalCalls,
        costEur: parseFloat(String(totals!.totalCostEur ?? "0")),
        inputTokens: parseInt(String(totals!.totalInputTokens ?? "0")),
        outputTokens: parseInt(String(totals!.totalOutputTokens ?? "0")),
      },
      byType: byType.map((r) => ({
        type: r.type,
        calls: r.calls,
        inputTokens: parseInt(String(r.totalInputTokens ?? "0")),
        outputTokens: parseInt(String(r.totalOutputTokens ?? "0")),
        costEur: parseFloat(String(r.totalCostEur ?? "0")),
      })),
      byUser: byUser.map((r) => ({
        userId: r.userId,
        calls: r.calls,
        costEur: parseFloat(String(r.totalCostEur ?? "0")),
      })),
      daily: groupedCosts.map((r) => ({
        date: r.date,
        costEur: parseFloat(String(r.totalCostEur ?? "0")),
        calls: r.calls,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin costs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id/premium", requireAdmin, async (req, res) => {
  try {
    const id = req.params["id"] as string;
    const { isPremium, premiumExpiresAt } = req.body as { isPremium?: boolean; premiumExpiresAt?: string };

    const premiumUntil = isPremium
      ? (premiumExpiresAt ? new Date(premiumExpiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
      : null;

    const [updated] = await db
      .update(userSettingsTable)
      .set({ premiumUntil })
      .where(eq(userSettingsTable.userId, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      userId: updated.userId,
      isPremium: updated.premiumUntil ? new Date(updated.premiumUntil) > new Date() : false,
      premiumExpiresAt: updated.premiumUntil,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle premium");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/users/:id/block", requireAdmin, async (req, res) => {
  try {
    const id = req.params["id"] as string;
    const { isBlocked } = req.body as { isBlocked?: boolean };

    const [updated] = await db
      .update(userSettingsTable)
      .set({ isBlocked: Boolean(isBlocked) })
      .where(eq(userSettingsTable.userId, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ userId: updated.userId, isBlocked: updated.isBlocked });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle block");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/health", requireAdmin, async (_req, res) => {
  const checks: Record<string, HealthCheck> = {};

  const dbStart = Date.now();
  try {
    await pool.query("SELECT 1");
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    checks.database = { status: "error", latencyMs: Date.now() - dbStart, error: message };
  }

  const claudeStart = Date.now();
  try {
    const resp = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "test", "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(5000),
    });
    checks.claudeApi = { status: resp.ok || resp.status === 401 ? "ok" : "error", latencyMs: Date.now() - claudeStart };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    checks.claudeApi = { status: "error", latencyMs: Date.now() - claudeStart, error: message };
  }

  const offStart = Date.now();
  try {
    const resp = await fetch("https://world.openfoodfacts.org/api/v2/search?page_size=1", {
      signal: AbortSignal.timeout(5000),
    });
    checks.openFoodFacts = { status: resp.ok ? "ok" : "error", latencyMs: Date.now() - offStart };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    checks.openFoodFacts = { status: "error", latencyMs: Date.now() - offStart, error: message };
  }

  checks.stripeWebhook = { status: "placeholder", error: "Stripe noch nicht integriert" };

  const allOk = Object.values(checks).every((c) => c.status === "ok" || c.status === "placeholder");
  res.json({ status: allOk ? "ok" : "degraded", checks });
});

router.get("/admin/me", requireAdmin, async (_req, res) => {
  res.json({ isAdmin: true });
});

router.post("/admin/restart", requireAdmin, async (req, res) => {
  req.log.warn("Admin-initiated server restart requested");
  res.json({ message: "Server wird neu gestartet…" });
  setTimeout(() => {
    process.exit(1);
  }, 500);
});

export default router;
