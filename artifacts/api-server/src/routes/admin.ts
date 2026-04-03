import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import {
  userSettingsTable,
  aiGenerationsTable,
  nutritionProfilesTable,
} from "@workspace/db";
import { eq, gte, lte, and, sql, count, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/role-check", requireAuth, async (req, res) => {
  const [row] = await db
    .select({ role: userSettingsTable.role })
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId!));
  res.json({ role: row?.role ?? "user" });
});

router.get("/admin/stats", requireAdmin, async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
  const monthAgo = new Date(todayStart.getTime() - 30 * 86400000);

  const [totalResult] = await db.select({ c: count() }).from(userSettingsTable);
  const totalUsers = totalResult?.c ?? 0;

  const [premiumResult] = await db
    .select({ c: count() })
    .from(userSettingsTable)
    .where(gte(userSettingsTable.premiumUntil, now));
  const premiumUsers = premiumResult?.c ?? 0;

  const [todayResult] = await db
    .select({ c: count() })
    .from(userSettingsTable)
    .where(gte(userSettingsTable.createdAt, todayStart));
  const newToday = todayResult?.c ?? 0;

  const [weekResult] = await db
    .select({ c: count() })
    .from(userSettingsTable)
    .where(gte(userSettingsTable.createdAt, weekAgo));
  const newWeek = weekResult?.c ?? 0;

  const [monthResult] = await db
    .select({ c: count() })
    .from(userSettingsTable)
    .where(gte(userSettingsTable.createdAt, monthAgo));
  const newMonth = monthResult?.c ?? 0;

  const [aiTotalCost] = await db
    .select({ total: sql<string>`COALESCE(SUM(cost_eur::numeric), 0)` })
    .from(aiGenerationsTable);

  const [aiTotalCalls] = await db.select({ c: count() }).from(aiGenerationsTable);

  res.json({
    totalUsers,
    premiumUsers,
    newToday,
    newWeek,
    newMonth,
    mrr: 0,
    aiTotalCostEur: Number(aiTotalCost?.total ?? 0),
    aiTotalCalls: aiTotalCalls?.c ?? 0,
  });
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  const rows = await db
    .select({
      userId: userSettingsTable.userId,
      role: userSettingsTable.role,
      blocked: userSettingsTable.blocked,
      premiumUntil: userSettingsTable.premiumUntil,
      householdSize: userSettingsTable.householdSize,
      budgetLevel: userSettingsTable.budgetLevel,
      bioPreferred: userSettingsTable.bioPreferred,
      activeProfileIds: userSettingsTable.activeProfileIds,
      createdAt: userSettingsTable.createdAt,
    })
    .from(userSettingsTable)
    .orderBy(desc(userSettingsTable.createdAt));

  const allProfileIds = [...new Set(rows.flatMap((r) => r.activeProfileIds))];
  let profileMap: Record<number, string> = {};
  if (allProfileIds.length > 0) {
    const profiles = await db
      .select({ id: nutritionProfilesTable.id, name: nutritionProfilesTable.name })
      .from(nutritionProfilesTable)
      .where(inArray(nutritionProfilesTable.id, allProfileIds));
    profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
  }

  const aiCosts = await db
    .select({
      userId: aiGenerationsTable.userId,
      calls: count(),
      totalCost: sql<string>`COALESCE(SUM(cost_eur::numeric), 0)`,
    })
    .from(aiGenerationsTable)
    .groupBy(aiGenerationsTable.userId);

  const aiMap: Record<string, { calls: number; totalCost: number }> = {};
  for (const row of aiCosts) {
    aiMap[row.userId] = { calls: row.calls, totalCost: Number(row.totalCost) };
  }

  const users = rows.map((r) => ({
    ...r,
    profileNames: r.activeProfileIds.map((id) => profileMap[id] ?? `Profil ${id}`),
    aiCalls: aiMap[r.userId]?.calls ?? 0,
    aiCostEur: aiMap[r.userId]?.totalCost ?? 0,
  }));

  res.json(users);
});

router.patch("/admin/users/:id/premium", requireAdmin, async (req, res) => {
  const userId = req.params["id"] as string;
  const { active } = req.body as { active: boolean };

  const premiumUntil = active
    ? new Date(Date.now() + 365 * 86400000)
    : null;

  await db
    .update(userSettingsTable)
    .set({ premiumUntil })
    .where(eq(userSettingsTable.userId, userId));

  res.json({ userId, premiumUntil });
});

router.patch("/admin/users/:id/block", requireAdmin, async (req, res) => {
  const userId = req.params["id"] as string;
  const { blocked } = req.body as { blocked: boolean };

  await db
    .update(userSettingsTable)
    .set({ blocked })
    .where(eq(userSettingsTable.userId, userId));

  res.json({ userId, blocked });
});

router.get("/admin/costs", requireAdmin, async (req, res) => {
  const dateFrom = req.query["dateFrom"] as string | undefined;
  const dateTo = req.query["dateTo"] as string | undefined;
  const userId = req.query["userId"] as string | undefined;
  const aiType = req.query["aiType"] as string | undefined;

  const conditions = [];
  if (dateFrom) conditions.push(gte(aiGenerationsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(aiGenerationsTable.createdAt, new Date(dateTo)));
  if (userId) conditions.push(eq(aiGenerationsTable.userId, userId));
  if (aiType) conditions.push(eq(aiGenerationsTable.type, aiType));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const byType = await db
    .select({
      type: aiGenerationsTable.type,
      calls: count(),
      totalCost: sql<string>`COALESCE(SUM(cost_eur::numeric), 0)`,
      totalInput: sql<string>`COALESCE(SUM(input_tokens), 0)`,
      totalOutput: sql<string>`COALESCE(SUM(output_tokens), 0)`,
    })
    .from(aiGenerationsTable)
    .where(whereClause)
    .groupBy(aiGenerationsTable.type);

  const byUser = await db
    .select({
      userId: aiGenerationsTable.userId,
      calls: count(),
      totalCost: sql<string>`COALESCE(SUM(cost_eur::numeric), 0)`,
    })
    .from(aiGenerationsTable)
    .where(whereClause)
    .groupBy(aiGenerationsTable.userId)
    .orderBy(desc(sql`SUM(cost_eur::numeric)`));

  const daily = await db
    .select({
      day: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      calls: count(),
      totalCost: sql<string>`COALESCE(SUM(cost_eur::numeric), 0)`,
    })
    .from(aiGenerationsTable)
    .where(whereClause)
    .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

  res.json({
    byType: byType.map((r) => ({ ...r, totalCost: Number(r.totalCost), totalInput: Number(r.totalInput), totalOutput: Number(r.totalOutput) })),
    byUser: byUser.map((r) => ({ ...r, totalCost: Number(r.totalCost) })),
    daily: daily.map((r) => ({ ...r, totalCost: Number(r.totalCost) })),
  });
});

router.get("/admin/health", requireAdmin, async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks["database"] = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks["database"] = { status: "error", latencyMs: Date.now() - dbStart };
  }

  const claudeStart = Date.now();
  try {
    const r = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: { "x-api-key": process.env["ANTHROPIC_API_KEY"] ?? "", "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(5000),
    });
    checks["claude_api"] = { status: r.ok ? "ok" : "degraded", latencyMs: Date.now() - claudeStart };
  } catch {
    checks["claude_api"] = { status: "error", latencyMs: Date.now() - claudeStart };
  }

  const offStart = Date.now();
  try {
    const r = await fetch("https://world.openfoodfacts.org/api/v2/product/737628064502.json", {
      signal: AbortSignal.timeout(5000),
    });
    checks["open_food_facts"] = { status: r.ok ? "ok" : "degraded", latencyMs: Date.now() - offStart };
  } catch {
    checks["open_food_facts"] = { status: "error", latencyMs: Date.now() - offStart };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  res.json({ status: allOk ? "healthy" : "degraded", checks });
});

export default router;
