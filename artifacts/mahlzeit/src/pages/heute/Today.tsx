import { Link, useLocation } from "wouter";
import { useGetTodayMeals, useGetActiveMealPlan } from "@workspace/api-client-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Loader2, ArrowRight, ChefHat, PlusCircle, Leaf, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const MEAL_COLORS: Record<string, string> = {
  breakfast: "bg-amber-500/10 border-amber-500/20",
  lunch: "bg-primary/10 border-primary/20",
  dinner: "bg-indigo-500/10 border-indigo-500/20",
  snack: "bg-emerald-500/10 border-emerald-500/20",
};

const MEAL_BAR_COLORS: Record<string, string> = {
  breakfast: "bg-amber-400",
  lunch: "bg-primary",
  dinner: "bg-indigo-400",
  snack: "bg-emerald-400",
};

export default function Today() {
  const { data: todaySummary, isLoading } = useGetTodayMeals();
  const { data: activePlan } = useGetActiveMealPlan({ query: { queryKey: ["/api/meal-plans/active"], retry: false } });
  const [, setLocation] = useLocation();

  const todayDate = new Date();
  const dayName = format(todayDate, "EEEE", { locale: de });
  const dateStr = format(todayDate, "d. MMMM yyyy", { locale: de });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasMeals = todaySummary?.meals && todaySummary.meals.length > 0;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary capitalize">{dayName}</h2>
        <p className="text-muted-foreground mt-1">{dateStr}</p>
        {activePlan && (
          <div className="mt-2 inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">{activePlan.title}</span>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 space-y-6">
        {!hasMeals ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-primary/5 rounded-3xl border border-primary/10">
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mb-4 shadow-sm">
              <ChefHat className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-2">Kein Plan für heute</h3>
            <p className="text-muted-foreground mb-6">
              Lass uns entspannt in die Woche starten. Erstelle deinen ersten Mahlzeitenplan.
            </p>
            <Link href="/plan" data-testid="link-create-plan">
              <Button className="rounded-full shadow-sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Plan erstellen
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {todaySummary.meals.map((meal, idx) => (
              <Card
                key={idx}
                className={`overflow-hidden border shadow-sm transition-all group ${MEAL_COLORS[meal.mealType] ?? "border-border/50"}`}
                data-testid={`card-meal-${meal.mealType}`}
              >
                <div className={`h-1.5 w-full ${MEAL_BAR_COLORS[meal.mealType] ?? "bg-primary/20"}`} />
                <CardContent className="p-5">
                  <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                    {MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType}
                  </div>
                  {meal.recipeName ? (
                    <>
                      <h4 className="font-display text-xl font-bold text-foreground mb-3">{meal.recipeName}</h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        {(meal.prepTime || meal.cookTime) && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 text-primary/70" />
                            <span className="font-mono">{(meal.prepTime || 0) + (meal.cookTime || 0)} min</span>
                          </div>
                        )}
                        {meal.energyType && (
                          <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20 text-xs font-medium gap-1">
                            <Leaf className="w-3 h-3" />
                            {meal.energyType}
                          </Badge>
                        )}
                        <div className="ml-auto flex gap-2">
                          {meal.recipeId && (
                            <Link href={`/rezepte/${meal.recipeId}`}>
                              <span className="text-xs text-primary font-medium hover:underline">Rezept</span>
                            </Link>
                          )}
                          {activePlan && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs rounded-full text-muted-foreground px-2 -mr-2"
                              onClick={() => setLocation(`/plan/${activePlan.id}`)}
                              data-testid={`btn-alternative-${meal.mealType}`}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Alternative
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground italic">Freie Mahlzeit</span>
                      {activePlan && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs rounded-full"
                          onClick={() => setLocation(`/plan/${activePlan.id}`)}
                        >
                          Hinzufügen
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 pt-4 pb-4">
          <Link href="/einkauf" data-testid="link-shopping-banner">
            <div className="bg-primary text-primary-foreground rounded-2xl p-5 flex items-center justify-between shadow-md hover:shadow-lg transition-shadow">
              <div>
                <h4 className="font-semibold text-lg">Einkaufsliste</h4>
                <p className="text-primary-foreground/80 text-sm mt-0.5">Für diese Woche</p>
              </div>
              <div className="w-10 h-10 bg-background/20 rounded-full flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
