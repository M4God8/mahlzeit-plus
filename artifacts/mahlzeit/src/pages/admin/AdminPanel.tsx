import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Activity,
  CreditCard,
  TrendingUp,
  Ban,
  Crown,
  RefreshCw,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Brain,
} from "lucide-react";

const API = "/api";

function useFetch<T>(key: string[], path: string, enabled = true) {
  return useQuery<T>({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const res = await fetch(`${API}${path}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });
}

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
  mrr: number;
  aiTotalCostEur: number;
  aiTotalCalls: number;
}

interface AdminUser {
  userId: string;
  role: string;
  blocked: boolean;
  premiumUntil: string | null;
  householdSize: number;
  budgetLevel: string;
  bioPreferred: boolean;
  activeProfileIds: number[];
  createdAt: string;
  profileNames: string[];
  aiCalls: number;
  aiCostEur: number;
}

interface CostData {
  byType: { type: string; calls: number; totalCost: number; totalInput: number; totalOutput: number }[];
  byUser: { userId: string; calls: number; totalCost: number }[];
  daily: { day: string; calls: number; totalCost: number }[];
}

interface HealthData {
  status: string;
  checks: Record<string, { status: string; latencyMs?: number }>;
}

type Tab = "dashboard" | "users" | "costs" | "health";

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  if (status === "ok") return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> OK</span>;
  if (status === "degraded") return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> Eingeschränkt</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Fehler</span>;
}

function DashboardTab() {
  const { data: stats, isPending } = useFetch<Stats>(["admin-stats"], "/admin/stats");
  const { data: health } = useFetch<HealthData>(["admin-health"], "/admin/health");

  if (isPending || !stats) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Gesamt User" value={stats.totalUsers} icon={Users} />
        <StatCard label="Premium" value={stats.premiumUsers} icon={Crown} />
        <StatCard label="Heute Neu" value={stats.newToday} icon={TrendingUp} sub={`Woche: ${stats.newWeek} · Monat: ${stats.newMonth}`} />
        <StatCard label="MRR" value={`€${stats.mrr}`} icon={CreditCard} sub="Stripe nicht integriert" />
        <StatCard label="KI-Kosten" value={`€${stats.aiTotalCostEur.toFixed(4)}`} icon={Brain} sub={`${stats.aiTotalCalls} Aufrufe`} />
      </div>

      {health && (
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> System Health</h3>
          <div className="space-y-2">
            {Object.entries(health.checks).map(([name, check]) => (
              <div key={name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground capitalize">{name.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2">
                  <HealthBadge status={check.status} />
                  {check.latencyMs !== undefined && <span className="text-xs text-muted-foreground">{check.latencyMs}ms</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isPending } = useFetch<AdminUser[]>(["admin-users"], "/admin/users");

  const togglePremium = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const res = await fetch(`${API}/admin/users/${userId}/premium`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`Premium toggle failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });

  const toggleBlock = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const res = await fetch(`${API}/admin/users/${userId}/block`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      if (!res.ok) throw new Error(`Block toggle failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  if (isPending || !users) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{users.length} User insgesamt</p>
      {users.map((u) => {
        const isPremium = u.premiumUntil && new Date(u.premiumUntil) > new Date();
        return (
          <div key={u.userId} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-mono text-foreground truncate">{u.userId}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Erstellt: {new Date(u.createdAt).toLocaleDateString("de-DE")}
                  {u.profileNames.length > 0 && ` · ${u.profileNames.join(", ")}`}
                </p>
              </div>
              <div className="flex gap-1 ml-2 flex-shrink-0">
                {u.role === "admin" && <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full font-medium">Admin</span>}
                {isPremium && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">Premium</span>}
                {u.blocked && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">Gesperrt</span>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-3">
              <span>Haushalt: {u.householdSize}</span>
              <span>Budget: {u.budgetLevel}</span>
              <span>Bio: {u.bioPreferred ? "Ja" : "Nein"}</span>
            </div>

            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-muted-foreground">KI: {u.aiCalls} Calls · €{u.aiCostEur.toFixed(4)}</span>
              {u.aiCostEur > 1 && <span className="text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Hoch</span>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => togglePremium.mutate({ userId: u.userId, active: !isPremium })}
                className="flex-1 text-xs py-1.5 rounded-lg border border-border font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
              >
                <Crown className="w-3 h-3" />
                {isPremium ? "Premium entfernen" : "Premium aktivieren"}
              </button>
              <button
                onClick={() => toggleBlock.mutate({ userId: u.userId, blocked: !u.blocked })}
                className="flex-1 text-xs py-1.5 rounded-lg border border-border font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
              >
                <Ban className="w-3 h-3" />
                {u.blocked ? "Entsperren" : "Sperren"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CostsTab() {
  const { data, isPending } = useFetch<CostData>(["admin-costs"], "/admin/costs");

  if (isPending || !data) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Kosten nach KI-Typ</h3>
        {data.byType.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine KI-Nutzung</p>
        ) : (
          <div className="space-y-2">
            {data.byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm font-mono">{t.type}</span>
                <div className="text-right">
                  <span className="text-sm font-medium">€{t.totalCost.toFixed(4)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{t.calls} Calls</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Kosten nach User</h3>
        {data.byUser.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine KI-Nutzung</p>
        ) : (
          <div className="space-y-2">
            {data.byUser.slice(0, 10).map((u) => (
              <div key={u.userId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs font-mono truncate max-w-[50%]">{u.userId}</span>
                <div className="text-right">
                  <span className="text-sm font-medium">€{u.totalCost.toFixed(4)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{u.calls} Calls</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.daily.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Tägliche Kosten</h3>
          <div className="space-y-1">
            {data.daily.slice(-14).map((d) => (
              <div key={d.day} className="flex items-center justify-between py-1 text-xs">
                <span className="text-muted-foreground">{d.day}</span>
                <span className="font-medium">€{d.totalCost.toFixed(4)} ({d.calls})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthTab() {
  const { data, isPending, refetch } = useFetch<HealthData>(["admin-health-detail"], "/admin/health");

  if (isPending || !data) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-foreground" />
          <span className="text-sm font-semibold">System Status</span>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
        >
          <RefreshCw className="w-3 h-3" /> Prüfen
        </button>
      </div>

      <div className={`text-center py-4 rounded-xl border ${data.status === "healthy" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-lg font-bold ${data.status === "healthy" ? "text-green-700" : "text-amber-700"}`}>
          {data.status === "healthy" ? "Alle Systeme OK" : "Einschränkungen erkannt"}
        </p>
      </div>

      {Object.entries(data.checks).map(([name, check]) => (
        <div key={name} className="bg-white rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{name.replace(/_/g, " ")}</span>
            <HealthBadge status={check.status} />
          </div>
          {check.latencyMs !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">Latenz: {check.latencyMs}ms</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Übersicht", icon: TrendingUp },
    { id: "users", label: "User", icon: Users },
    { id: "costs", label: "Kosten", icon: CreditCard },
    { id: "health", label: "Health", icon: Activity },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <a href="/heute" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </a>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-display font-bold text-foreground">Admin-Panel</h1>
        </div>

        <div className="flex gap-1 mt-3 bg-muted/50 rounded-lg p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
                tab === id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-4 pb-24">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users" && <UsersTab />}
        {tab === "costs" && <CostsTab />}
        {tab === "health" && <HealthTab />}
      </main>
    </div>
  );
}
