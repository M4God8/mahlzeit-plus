import { useState } from "react";
import { useLocation } from "wouter";
import { useListMealPlans, useActivateMealPlan, useGetActiveMealPlan } from "@workspace/api-client-react";
import type { MealPlanDetail, MealPlanDay } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Calendar as CalendarIcon,
  List,
  Plus,
  Zap,
  ChevronRight,
  ChefHat,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import PlanCreate from "./PlanCreate";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "list" | "calendar";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So", "Tag 8", "Tag 9", "Tag 10", "Tag 11", "Tag 12", "Tag 13", "Tag 14"];

function getDayNumberForDate(activePlan: MealPlanDetail, date: Date): number {
  const planStart = new Date(activePlan.createdAt);
  planStart.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - planStart.getTime()) / (24 * 60 * 60 * 1000));
  return (diffDays % activePlan.cycleLengthDays) + 1;
}

function getPlanDayForDate(activePlan: MealPlanDetail, date: Date): MealPlanDay | undefined {
  const dayNumber = getDayNumberForDate(activePlan, date);
  return activePlan.days?.find(d => d.dayNumber === dayNumber);
}

interface DayDetailDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  activePlan: MealPlanDetail | null;
  onOpenPlan: () => void;
}

function DayDetailDialog({ open, onClose, date, activePlan, onOpenPlan }: DayDetailDialogProps) {
  if (!date || !activePlan) return null;

  const planDay = getPlanDayForDate(activePlan, date);
  const dayNumber = getDayNumberForDate(activePlan, date);
  const dayName = DAY_NAMES[dayNumber - 1] ?? `Tag ${dayNumber}`;

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {format(date, "EEEE, d. MMM", { locale: de })}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activePlan.title} · {dayName}
          </p>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {mealTypes.map(mealType => {
            const entry = planDay?.entries?.find(e => e.mealType === mealType);
            return (
              <div
                key={mealType}
                className={`p-3 rounded-xl ${entry?.recipe ? "bg-primary/5 border border-primary/15" : "bg-muted/50 border border-dashed border-border/50"}`}
              >
                <div className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">
                  {MEAL_TYPE_LABELS[mealType] ?? mealType}
                </div>
                {entry?.recipe ? (
                  <div className="font-semibold text-sm">{entry.recipe.title}</div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">Noch kein Gericht geplant</div>
                )}
              </div>
            );
          })}
        </div>

        <Button
          className="w-full rounded-xl mt-2"
          variant="outline"
          onClick={() => { onClose(); onOpenPlan(); }}
          data-testid="btn-day-detail-open-plan"
        >
          <ChefHat className="w-4 h-4 mr-2" />
          Plan bearbeiten
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: activePlan } = useGetActiveMealPlan({ query: { queryKey: ["/api/meal-plans/active"], retry: false } });
  const [, setLocation] = useLocation();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const isDayPlanned = (date: Date) => {
    if (!activePlan) return false;
    const planStart = new Date(activePlan.createdAt);
    planStart.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return target >= planStart;
  };

  const hasMealsOnDay = (date: Date) => {
    if (!activePlan) return false;
    const planDay = getPlanDayForDate(activePlan, date);
    return planDay ? (planDay.entries?.length ?? 0) > 0 : false;
  };

  const handleDayTap = (day: Date) => {
    if (!activePlan || !isDayPlanned(day)) return;
    setSelectedDay(day);
    setDayDetailOpen(true);
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
              onClick={() => handleDayTap(day)}
              disabled={!planned}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium transition-all ${
                today ? "bg-primary text-primary-foreground" :
                planned && hasMeals ? "bg-primary/15 text-foreground hover:bg-primary/20" :
                planned ? "bg-muted/80 text-muted-foreground hover:bg-muted" :
                "text-foreground/40 cursor-default"
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
              <div className="text-xs text-muted-foreground mt-0.5">{activePlan.cycleLengthDays} Tage · Tippe auf einen Tag für Details</div>
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

      <DayDetailDialog
        open={dayDetailOpen}
        onClose={() => { setDayDetailOpen(false); setSelectedDay(null); }}
        date={selectedDay}
        activePlan={activePlan ?? null}
        onOpenPlan={() => activePlan && setLocation(`/plan/${activePlan.id}`)}
      />
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
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block" />
                          Manuell
                        </span>
                        {plan.repeatEnabled && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                            Loop
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
