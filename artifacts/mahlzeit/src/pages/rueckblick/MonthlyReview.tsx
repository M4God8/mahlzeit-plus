import { useState } from "react";
import { useGetMonthlyReview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Euro,
  Leaf,
  Recycle,
  Star,
  TrendingUp,
  TrendingDown,
  Award,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const PIE_COLORS = ["#f59e0b", "#6366f1", "#8b5cf6", "#10b981", "#f97316", "#ec4899"];

const CATEGORY_COLORS: Record<string, string> = {
  "Gemüse": "#22c55e",
  "Obst": "#f59e0b",
  "Protein": "#ef4444",
  "Getreide": "#d97706",
  "Milchprodukte": "#3b82f6",
  "Gewürze": "#8b5cf6",
  "Öle & Fette": "#f97316",
  "Hülsenfrüchte": "#14b8a6",
  "Nüsse & Samen": "#a16207",
  "Sonstiges": "#94a3b8",
};

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function getDefaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(monthStr: string): { year: number; month: number } {
  const [y, m] = monthStr.split("-");
  return { year: parseInt(y!), month: parseInt(m!) };
}

function formatMonth(monthStr: string): string {
  const { year, month } = parseMonth(monthStr);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function navigateMonth(monthStr: string, delta: number): string {
  const { year, month } = parseMonth(monthStr);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Ausgezeichnet";
  if (score >= 60) return "Gut";
  if (score >= 40) return "Ausbaufähig";
  return "Verbesserungspotential";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50 border-emerald-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">von 100</span>
      </div>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function MonthlyReview() {
  const [month, setMonth] = useState(getDefaultMonth);
  const { data, isLoading } = useGetMonthlyReview(
    { month },
    { query: { queryKey: ["/api/review/monthly", month] } }
  );

  const canGoForward = month < getDefaultMonth();

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary">Rückblick</h2>
        <p className="text-muted-foreground mt-1">Dein monatlicher Überblick</p>
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setMonth((m) => navigateMonth(m, -1))}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-display text-lg font-semibold">{formatMonth(month)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setMonth((m) => navigateMonth(m, 1))}
            disabled={!canGoForward}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>Keine Daten für diesen Monat verfügbar.</p>
          </div>
        ) : (
          <>
            <Card className={`border shadow-sm ${getScoreBg(data.score)}`}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Award className={`w-5 h-5 ${getScoreColor(data.score)}`} />
                  <h3 className="font-display text-xl font-bold">Dein bewusstes Leben</h3>
                </div>
                <ScoreRing score={data.score} />
                <p className={`text-center font-semibold ${getScoreColor(data.score)}`}>
                  {getScoreLabel(data.score)}
                </p>
                <div className="space-y-3 pt-2">
                  <BreakdownBar label="Regelmässigkeit" value={data.scoreBreakdown.regularity} />
                  <BreakdownBar label="Vielfalt" value={data.scoreBreakdown.variety} />
                  <BreakdownBar label="Kosten-Effizienz" value={data.scoreBreakdown.costEfficiency} />
                  <BreakdownBar label="Food-Waste-Vermeidung" value={data.scoreBreakdown.wasteAvoidance} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-primary" />
                  Was haben wir gegessen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mahlzeiten gesamt</span>
                  <span className="font-mono text-lg font-bold text-primary">
                    {data.mealDistribution.total}
                  </span>
                </div>

                {data.mealDistribution.byType.length > 0 && (
                  <div className="flex justify-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={data.mealDistribution.byType.map((t) => ({
                            name: MEAL_TYPE_LABELS[t.type] || t.type,
                            value: t.count,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.mealDistribution.byType.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e5e7eb",
                            fontSize: "13px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {data.mealDistribution.byType.map((t, i) => (
                    <div key={t.type} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {MEAL_TYPE_LABELS[t.type] || t.type} ({t.count})
                      </span>
                    </div>
                  ))}
                </div>

                {data.mealDistribution.topRecipes.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-semibold text-muted-foreground">Top-Rezepte</p>
                    {data.mealDistribution.topRecipes.map((r, i) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-5">
                            #{i + 1}
                          </span>
                          <span className="text-sm font-medium truncate max-w-[180px]">
                            {r.title}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {r.count}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Euro className="w-4 h-4 text-primary" />
                  Was hat es gekostet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Gesamt (Ø)</p>
                    <p className="font-mono text-lg font-bold">{data.costs.totalAvg.toFixed(2)}€</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Pro Tag (Ø)</p>
                    <p className="font-mono text-lg font-bold">{data.costs.perDayAvg.toFixed(2)}€</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Pro Woche (Ø)</p>
                    <p className="font-mono text-lg font-bold">{data.costs.perWeekAvg.toFixed(2)}€</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Spanne</p>
                    <p className="font-mono text-sm font-medium">
                      {data.costs.totalMin.toFixed(2)}€ – {data.costs.totalMax.toFixed(2)}€
                    </p>
                  </div>
                </div>

                {data.costs.previousMonth && (
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3">
                    {data.costs.totalAvg <= data.costs.previousMonth.totalAvg ? (
                      <TrendingDown className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <div className="text-sm">
                      <span className="font-medium">Vormonat: </span>
                      <span className="font-mono">
                        {data.costs.previousMonth.totalAvg.toFixed(2)}€
                      </span>
                      {data.costs.previousMonth.totalAvg > 0 && data.costs.totalAvg <= data.costs.previousMonth.totalAvg && (
                        <span className="text-emerald-600 ml-1">
                          ({(
                            ((data.costs.previousMonth.totalAvg - data.costs.totalAvg) /
                              data.costs.previousMonth.totalAvg) *
                            100
                          ).toFixed(0)}
                          % gespart)
                        </span>
                      )}
                      {data.costs.previousMonth.totalAvg > 0 && data.costs.totalAvg > data.costs.previousMonth.totalAvg && (
                        <span className="text-red-600 ml-1">
                          (+
                          {(
                            ((data.costs.totalAvg - data.costs.previousMonth.totalAvg) /
                              data.costs.previousMonth.totalAvg) *
                            100
                          ).toFixed(0)}
                          %)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-primary" />
                  Ernährungs-Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.nutritionBalance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(180, data.nutritionBalance.length * 36)}>
                    <BarChart
                      data={data.nutritionBalance.map((c) => ({
                        name: c.category,
                        count: c.count,
                      }))}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          fontSize: "13px",
                        }}
                        formatter={(value: number) => [`${value} Zutaten`, "Anzahl"]}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {data.nutritionBalance.map((c, i) => (
                          <Cell
                            key={c.category}
                            fill={CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Keine Zutatendaten für diesen Monat.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Recycle className="w-4 h-4 text-primary" />
                  Food Waste vermieden
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="font-mono text-2xl font-bold text-emerald-600">
                      {data.foodWaste.itemsUsedBeforeExpiry}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">Verwertet</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="font-mono text-2xl font-bold text-red-600">
                      {data.foodWaste.itemsExpired}
                    </p>
                    <p className="text-xs text-red-700 mt-1">Abgelaufen</p>
                  </div>
                  <div className="bg-primary/5 rounded-xl p-3">
                    <p className="font-mono text-2xl font-bold text-primary">
                      {data.foodWaste.wastePreventionRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Vermeidungsrate</p>
                  </div>
                </div>

                {data.foodWaste.itemsUsedBeforeExpiry + data.foodWaste.itemsExpired === 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Noch keine Kühlschrank-Daten für diesen Monat. Nutze den Scanner, um Zutaten zu tracken.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
