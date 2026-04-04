import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { useUser, Show } from "@clerk/react";
import { Loader2, Users, CreditCard, Activity, TrendingUp, AlertTriangle, ShieldCheck, ShieldOff, Ban, CheckCircle, XCircle, Clock, Package } from "lucide-react";
import { ProductsPanel } from "./ProductsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DEFAULT_COST_THRESHOLD = 1.0;

const AI_TYPE_LABELS: Record<string, string> = {
  "generate-recipe": "Rezept generieren",
  "generate-plan": "Plan generieren",
  "adjust-recipe": "Rezept anpassen",
  "substitute-ingredient": "Zutat ersetzen",
};

interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  newUsersMonth: number;
  mrr: number;
  mrrNote: string;
  totalAiCostEur: number;
  totalAiCalls: number;
}

interface AdminUser {
  userId: string;
  email: string;
  role: string;
  isPremium: boolean;
  premiumExpiresAt: string | null;
  isBlocked: boolean;
  createdAt: string;
  householdSize: number;
  budgetLevel: string;
  profiles: string[];
  aiCalls: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  aiCostEur: number;
}

interface CostsByType {
  type: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
}

interface CostsByUser {
  userId: string;
  calls: number;
  costEur: number;
}

interface DailyCost {
  date: string;
  costEur: number;
  calls: number;
}

interface AdminCosts {
  totals: { calls: number; costEur: number; inputTokens: number; outputTokens: number };
  byType: CostsByType[];
  byUser: CostsByUser[];
  daily: DailyCost[];
}

interface HealthCheck {
  status: string;
  latencyMs?: number;
  error?: string;
}

interface AdminHealth {
  status: string;
  checks: Record<string, HealthCheck>;
}

async function adminFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    if (res.status === 403) throw new Error("FORBIDDEN");
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function useAdminCheck() {
  return useQuery({
    queryKey: ["admin-check"],
    queryFn: () => adminFetch<{ isAdmin: boolean }>("/admin/me"),
    retry: false,
  });
}

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminFetch<AdminStats>("/admin/stats"),
    refetchInterval: 30000,
  });
}

function useAdminUsers(filters: Record<string, string>) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v && v !== "all")
  ).toString();
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => adminFetch<AdminUser[]>(`/admin/users?${params}`),
  });
}

function useAdminCosts(filters: Record<string, string>) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v && v !== "all")
  ).toString();
  return useQuery({
    queryKey: ["admin-costs", params],
    queryFn: () => adminFetch<AdminCosts>(`/admin/costs?${params}`),
  });
}

function useAdminHealth() {
  return useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminFetch<AdminHealth>("/admin/health"),
    refetchInterval: 60000,
  });
}

function StatsCards() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Gesamt-User", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
    { label: "Premium-User", value: stats.premiumUsers, icon: ShieldCheck, color: "text-emerald-600" },
    { label: "Neue User (heute)", value: stats.newUsersToday, sub: `Woche: ${stats.newUsersWeek} · Monat: ${stats.newUsersMonth}`, icon: TrendingUp, color: "text-violet-600" },
    { label: "MRR", value: `€${stats.mrr}`, sub: stats.mrrNote, icon: CreditCard, color: "text-amber-600" },
    { label: "KI-Gesamtkosten", value: `€${stats.totalAiCostEur.toFixed(4)}`, sub: `${stats.totalAiCalls} Aufrufe`, icon: Activity, color: "text-rose-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-xl font-bold">{c.value}</div>
            {c.sub && <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UserTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: users, isLoading } = useAdminUsers(filters);

  const premiumMutation = useMutation({
    mutationFn: ({ userId, isPremium }: { userId: string; isPremium: boolean }) =>
      adminFetch(`/admin/users/${userId}/premium`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPremium }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "Premium-Status aktualisiert" });
    },
  });

  const blockMutation = useMutation({
    mutationFn: ({ userId, isBlocked }: { userId: string; isBlocked: boolean }) =>
      adminFetch(`/admin/users/${userId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Block-Status aktualisiert" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={filters.plan ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, plan: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Pläne</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.aiUsage ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, aiUsage: v }))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="KI-Usage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="high">Hoch (&gt;€1)</SelectItem>
            <SelectItem value="medium">Mittel</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.periodDays ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, periodDays: v }))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="1">Heute</SelectItem>
            <SelectItem value="7">Letzte 7 Tage</SelectItem>
            <SelectItem value="30">Letzte 30 Tage</SelectItem>
            <SelectItem value="90">Letzte 90 Tage</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Ernährungsprofil filtern…"
          value={filters.profile ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, profile: e.target.value }))}
          className="w-[200px] h-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>KI-Calls</TableHead>
                <TableHead>KI-Kosten</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u: AdminUser) => (
                <TableRow key={u.userId}>
                  <TableCell className="text-xs max-w-[200px] truncate" title={u.email || u.userId}>
                    {u.email || <span className="font-mono">{u.userId.slice(0, 12)}…</span>}
                    {u.isBlocked && <Badge variant="destructive" className="ml-1 text-[10px]">Gesperrt</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.profiles.map((p: string) => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("de-DE") : "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isPremium ? "default" : "outline"} className="text-[10px]">
                      {u.isPremium ? "Premium" : "Free"}
                    </Badge>
                    {u.isPremium && u.premiumExpiresAt && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        bis {new Date(u.premiumExpiresAt).toLocaleDateString("de-DE")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{u.aiCalls}</TableCell>
                  <TableCell>
                    <span className="text-sm">€{u.aiCostEur.toFixed(4)}</span>
                    {u.aiCostEur > DEFAULT_COST_THRESHOLD && (
                      <Badge variant="destructive" className="ml-1 text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" />
                        Hoch
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant={u.isPremium ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={premiumMutation.isPending}
                        onClick={() => premiumMutation.mutate({ userId: u.userId, isPremium: !u.isPremium })}
                      >
                        {u.isPremium ? <ShieldOff className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                        {u.isPremium ? "Free" : "Premium"}
                      </Button>
                      <Button
                        variant={u.isBlocked ? "outline" : "destructive"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={blockMutation.isPending}
                        onClick={() => blockMutation.mutate({ userId: u.userId, isBlocked: !u.isBlocked })}
                      >
                        {u.isBlocked ? <CheckCircle className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
                        {u.isBlocked ? "Freigeben" : "Sperren"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Keine User gefunden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CostsPanel() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [userIdInput, setUserIdInput] = useState("");
  const { data: costs, isLoading } = useAdminCosts(filters);

  const setDateRange = useCallback((range: string) => {
    if (range === "all") {
      setFilters((f) => {
        const newFilters = { ...f };
        delete newFilters.dateFrom;
        delete newFilters.dateTo;
        return newFilters;
      });
      return;
    }
    const now = new Date();
    const from = new Date();
    if (range === "7") from.setDate(now.getDate() - 7);
    else if (range === "30") from.setDate(now.getDate() - 30);
    else if (range === "90") from.setDate(now.getDate() - 90);
    setFilters((f) => ({ ...f, dateFrom: from.toISOString(), dateTo: now.toISOString() }));
  }, []);

  const applyUserFilter = useCallback(() => {
    setFilters((f) => {
      if (!userIdInput.trim()) {
        const newFilters = { ...f };
        delete newFilters.userId;
        return newFilters;
      }
      return { ...f, userId: userIdInput.trim() };
    });
  }, [userIdInput]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!costs) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <Select onValueChange={setDateRange} defaultValue="all">
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="7">Letzte 7 Tage</SelectItem>
            <SelectItem value="30">Letzte 30 Tage</SelectItem>
            <SelectItem value="90">Letzte 90 Tage</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.aiType ?? "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, aiType: v === "all" ? "" : v }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="KI-Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(AI_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.groupBy ?? "day"}
          onValueChange={(v) => setFilters((f) => ({ ...f, groupBy: v }))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Gruppierung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Täglich</SelectItem>
            <SelectItem value="week">Wöchentlich</SelectItem>
            <SelectItem value="month">Monatlich</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Input
            placeholder="User-ID filtern…"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            className="w-[200px] h-9"
            onKeyDown={(e) => { if (e.key === "Enter") applyUserFilter(); }}
          />
          <Button variant="outline" size="sm" className="h-9" onClick={applyUserFilter}>
            Filtern
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Gesamt-Aufrufe</div>
            <div className="text-xl font-bold">{costs.totals.calls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Gesamtkosten</div>
            <div className="text-xl font-bold">€{costs.totals.costEur.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Input-Tokens</div>
            <div className="text-xl font-bold">{costs.totals.inputTokens.toLocaleString("de-DE")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Output-Tokens</div>
            <div className="text-xl font-bold">{costs.totals.outputTokens.toLocaleString("de-DE")}</div>
          </CardContent>
        </Card>
      </div>

      {costs.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Kosten-Verlauf ({filters.groupBy === "week" ? "wöchentlich" : filters.groupBy === "month" ? "monatlich" : "täglich"})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costs.daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getDate()}.${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${v.toFixed(3)}`} />
                  <Tooltip
                    formatter={(value: number) => [`€${value.toFixed(4)}`, "Kosten"]}
                    labelFormatter={(label: string) => new Date(label).toLocaleDateString("de-DE")}
                  />
                  <Line type="monotone" dataKey="costEur" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kosten nach KI-Typ</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Aufrufe</TableHead>
                <TableHead>Input-Tokens</TableHead>
                <TableHead>Output-Tokens</TableHead>
                <TableHead>Kosten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.byType.map((r: CostsByType) => (
                <TableRow key={r.type}>
                  <TableCell>{AI_TYPE_LABELS[r.type] ?? r.type}</TableCell>
                  <TableCell>{r.calls}</TableCell>
                  <TableCell>{r.inputTokens.toLocaleString("de-DE")}</TableCell>
                  <TableCell>{r.outputTokens.toLocaleString("de-DE")}</TableCell>
                  <TableCell>€{r.costEur.toFixed(4)}</TableCell>
                </TableRow>
              ))}
              {costs.byType.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">Keine Daten</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Kosten pro User (Top)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User-ID</TableHead>
                <TableHead>Aufrufe</TableHead>
                <TableHead>Kosten</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.byUser.slice(0, 20).map((r: CostsByUser) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-mono text-xs">{r.userId.slice(0, 16)}…</TableCell>
                  <TableCell>{r.calls}</TableCell>
                  <TableCell>€{r.costEur.toFixed(4)}</TableCell>
                  <TableCell>
                    {r.costEur > DEFAULT_COST_THRESHOLD && (
                      <Badge variant="destructive" className="text-[10px]">
                        <AlertTriangle className="w-3 h-3 mr-0.5" />
                        Schwellenwert
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthPanel() {
  const { data: health, isLoading, refetch } = useAdminHealth();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!health) return null;

  const statusIcon = (status: string) => {
    if (status === "ok") return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    if (status === "placeholder") return <Clock className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const checks = Object.entries(health.checks) as [string, HealthCheck][];

  const checkLabels: Record<string, string> = {
    database: "Datenbank (PostgreSQL)",
    claudeApi: "Claude API (Anthropic)",
    openFoodFacts: "Open Food Facts API",
    stripeWebhook: "Stripe Webhook",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={health.status === "ok" ? "default" : "destructive"}>
            System: {health.status === "ok" ? "Gesund" : "Eingeschränkt"}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Aktualisieren
        </Button>
      </div>

      <div className="grid gap-3">
        {checks.map(([key, check]) => (
          <Card key={key}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcon(check.status)}
                <div>
                  <div className="font-medium text-sm">{checkLabels[key] ?? key}</div>
                  {check.error && <div className="text-xs text-muted-foreground">{check.error}</div>}
                </div>
              </div>
              {check.latencyMs !== undefined && (
                <Badge variant="outline" className="text-xs">{check.latencyMs}ms</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Admin-Panel</h1>
          <p className="text-sm text-muted-foreground">Mahlzeit+ Verwaltung</p>
        </div>

        <div className="mb-6">
          <StatsCards />
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">User</TabsTrigger>
            <TabsTrigger value="costs">Kosten</TabsTrigger>
            <TabsTrigger value="products">Produkte</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UserTable />
          </TabsContent>

          <TabsContent value="costs">
            <CostsPanel />
          </TabsContent>

          <TabsContent value="products">
            <ProductsPanel />
          </TabsContent>

          <TabsContent value="health">
            <HealthPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { data, isLoading, isError, error } = useAdminCheck();

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/" />;
  }

  if (isError) {
    const isForbidden = error?.message === "FORBIDDEN";
    if (isForbidden) {
      return <Redirect to="/heute" />;
    }
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">Fehler</p>
          <p className="text-sm text-muted-foreground">Admin-Bereich nicht verfügbar</p>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}
