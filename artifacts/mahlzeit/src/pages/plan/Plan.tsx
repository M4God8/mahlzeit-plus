import { useState } from "react";
import { useLocation } from "wouter";
import { useListMealPlans, useActivateMealPlan, useGetActiveMealPlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar as CalendarIcon,
  List,
  Plus,
  Zap,
  ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { de } from "date-fns/locale";
import PlanCreate from "./PlanCreate";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "list" | "calendar";

function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: activePlan } = useGetActiveMealPlan({ query: { queryKey: ["/api/meal-plans/active"], retry: false } });
  const [, setLocation] = useLocation();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const planCreatedAt = activePlan ? new Date(activePlan.createdAt) : null;
  const planEndDay = planCreatedAt && activePlan
    ? new Date(planCreatedAt.getTime() + activePlan.cycleLengthDays * 24 * 60 * 60 * 1000)
    : null;

  const isDayPlanned = (date: Date) => {
    if (!planCreatedAt || !planEndDay) return false;
    return date >= planCreatedAt && date < planEndDay;
  };

  const hasMealsOnDay = (date: Date) => {
    if (!activePlan) return false;
    const planStart = new Date(activePlan.createdAt);
    planStart.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((targetDate.getTime() - planStart.getTime()) / (24 * 60 * 60 * 1000));
    const dayNumber = (diffDays % activePlan.cycleLengthDays) + 1;
    const planDay = activePlan.days?.find(d => d.dayNumber === dayNumber);
    return planDay ? (planDay.entries?.length ?? 0) > 0 : false;
  };

  const weekDayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronRight className="w-5 h-5 rotate-180" />
        </Button>
        <h3 className="font-display font-bold text-base capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: de })}
        </h3>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDayNames.map(d => (
          <div key={d} className="text-[10px] font-bold text-muted-foreground uppercase py-1">{d}</div>
        ))}
        {Array.from({ length: paddingDays }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const today = isSameDay(day, new Date());
          const planned = isDayPlanned(day);
          const hasMeals = hasMealsOnDay(day);
          const inMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (activePlan && planned) setLocation(`/plan/${activePlan.id}`);
              }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium transition-all ${
                today ? "bg-primary text-primary-foreground" :
                planned && hasMeals ? "bg-primary/15 text-foreground hover:bg-primary/20" :
                planned ? "bg-muted/80 text-muted-foreground hover:bg-muted" :
                "text-foreground/60"
              } ${!inMonth ? "opacity-30" : ""}`}
              data-testid={`cal-day-${format(day, "d")}`}
            >
              <span className="text-xs leading-none">{format(day, "d")}</span>
              {hasMeals && !today && (
                <div className="w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {activePlan ? (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Aktiver Plan</div>
              <div className="font-display font-bold">{activePlan.title}</div>
            </div>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setLocation(`/plan/${activePlan.id}`)}>
              Öffnen
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-muted-foreground py-4">
          Kein aktiver Plan. Erstelle einen Plan, um Tage zu markieren.
        </div>
      )}
    </div>
  );
}

export default function Plan() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useListMealPlans();
  const activatePlan = useActivateMealPlan();

  const handleActivate = (planId: number) => {
    activatePlan.mutate(
      { id: planId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
          queryClient.invalidateQueries({ queryKey: ["/api/meal-plans/active"] });
          queryClient.invalidateQueries({ queryKey: ["/api/today"] });
          toast({ title: "Plan aktiviert" });
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500">
      <header className="px-6 pt-10 pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border/30">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="font-display text-4xl font-bold text-primary">Plan</h2>
            <p className="text-muted-foreground mt-1">Deine Mahlzeiten</p>
          </div>
          <Button
            size="icon"
            className="rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
            data-testid="btn-new-plan"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex gap-1 bg-muted/60 rounded-full p-1 w-fit">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            data-testid="tab-list"
          >
            <List className="w-3.5 h-3.5" />
            Liste
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${viewMode === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            data-testid="tab-calendar"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Kalender
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        {viewMode === "calendar" ? (
          <CalendarView />
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map(plan => (
              <Card
                key={plan.id}
                className={`overflow-hidden border-border/50 shadow-sm transition-all cursor-pointer hover:shadow-md ${plan.active ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
                onClick={() => setLocation(`/plan/${plan.id}`)}
                data-testid={`card-plan-${plan.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display text-lg font-bold truncate">{plan.title}</h3>
                        {plan.active && (
                          <Badge className="bg-primary/10 text-primary border-0 rounded-full text-[10px] px-2 py-0 shrink-0">Aktiv</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {plan.cycleLengthDays} Tage
                        </span>
                        {plan.repeatEnabled && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                            Wiederholt sich
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!plan.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-xs h-8 px-3"
                          onClick={(e) => { e.stopPropagation(); handleActivate(plan.id); }}
                          disabled={activatePlan.isPending}
                          data-testid={`btn-activate-${plan.id}`}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Aktivieren
                        </Button>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-muted/40 rounded-3xl border border-dashed border-border">
            <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Noch keine Pläne</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Erstelle deinen ersten Mahlzeitenplan für eine entspannte Woche.
            </p>
            <Button className="rounded-full" onClick={() => setCreateOpen(true)} data-testid="btn-create-first-plan">
              <Plus className="w-4 h-4 mr-2" />
              Plan erstellen
            </Button>
          </div>
        )}
      </main>

      <PlanCreate
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => setLocation(`/plan/${id}`)}
      />
    </div>
  );
}
