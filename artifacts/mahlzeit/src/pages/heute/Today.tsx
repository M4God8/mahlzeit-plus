import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetTodayMeals, useGetActiveMealPlan, useGenerateShoppingList, useAiSubmitFeedback, useGetLearnProfile, useGetTodayCost } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Loader2, ArrowRight, ChefHat, PlusCircle, Leaf, RefreshCw, ShoppingCart, ThumbsUp, ThumbsDown, Minus, Sparkles, X, Euro, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  const { data: learnProfile } = useGetLearnProfile({ query: { queryKey: ["/api/learn/profile"], retry: false } });
  const { data: todayCost } = useGetTodayCost({ query: { queryKey: ["/api/costs/today"] } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const generateList = useGenerateShoppingList();
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "thumbs_up" | "neutral" | "thumbs_down">>({});
  const [insightDismissed, setInsightDismissed] = useState(false);

  const feedbackMutation = useAiSubmitFeedback({
    mutation: {
      onSuccess: (_, variables) => {
        const { rating, mealEntryId } = variables.data;
        const key = `entry-${mealEntryId}`;
        setFeedbackGiven((prev) => ({ ...prev, [key]: rating }));
        toast({
          title: rating === "thumbs_up" ? "👍 Danke!" : rating === "thumbs_down" ? "👎 Schade! Wir merken uns das." : "😐 Feedback gespeichert.",
          description: "Dein Feedback hilft uns, bessere Vorschläge zu machen.",
        });
      },
    },
  });

  const handleFeedback = (rating: "thumbs_up" | "neutral" | "thumbs_down", mealEntryId: number, recipeId?: number | null) => {
    feedbackMutation.mutate({ data: { rating, mealEntryId, recipeId: recipeId ?? undefined } });
  };

  const handleGenerateList = () => {
    generateList.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
        toast({ title: "Einkaufsliste erstellt" });
        setLocation("/einkauf");
      },
      onError: () => toast({ title: "Fehler beim Erstellen", variant: "destructive" }),
    });
  };

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

  const hasPlan = todaySummary?.hasPlan === true;
  const hasMeals = hasPlan && todaySummary?.meals && todaySummary.meals.length > 0;

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
        {todaySummary?.expiringItems && todaySummary.expiringItems.length > 0 && (
          <button
            onClick={() => {
              const names = todaySummary.expiringItems!.map((i) => i.ingredientName).join(", ");
              setLocation(`/ki?context=${encodeURIComponent(`Rezept mit diesen bald ablaufenden Zutaten: ${names}`)}`);
            }}
            className="w-full flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 text-left hover:bg-yellow-100 transition-colors animate-in slide-in-from-top-2 duration-300"
          >
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800 leading-snug">
                <span className="font-semibold">Bald aufbrauchen: </span>
                {todaySummary.expiringItems.map((i) => i.ingredientName).join(", ")}
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">Tap für Rezeptvorschläge</p>
            </div>
          </button>
        )}

        {!hasMeals ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <ChefHat className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-3">Noch kein Plan aktiv</h3>
            <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">
              Starte mit deinem ersten Wochenplan — die App erstellt dir Vorschläge, Einkaufslisten und mehr.
            </p>
            <Link href="/plan" data-testid="link-create-plan">
              <Button size="lg" className="rounded-full shadow-md px-8 text-base">
                <PlusCircle className="w-5 h-5 mr-2" />
                Ersten Plan erstellen
              </Button>
            </Link>
          </div>
        ) : (
          <>
          {todayCost && todayCost.avg > 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Euro className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  Tageskosten: ca. {todayCost.min.toFixed(2)}€ – {todayCost.max.toFixed(2)}€
                </p>
                <p className="text-xs text-emerald-600">∅ {todayCost.avg.toFixed(2)}€ pro Person</p>
              </div>
            </div>
          )}

          {learnProfile?.insightMessage && !insightDismissed && (
            <div className="relative flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 animate-in slide-in-from-top-2 duration-300">
              <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 flex-1 leading-snug">
                <span className="font-semibold">Dein Profil sagt: </span>
                {learnProfile.insightMessage}
              </p>
              <button
                onClick={() => setInsightDismissed(true)}
                className="text-amber-400 hover:text-amber-600 shrink-0"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

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
                            <Link href={`/rezepte/${meal.recipeId}?mealEntryId=${meal.id}&mealPlanDayId=${meal.mealPlanDayId ?? ""}&planId=${todaySummary?.planId ?? ""}${meal.overrideServings ? `&overrideServings=${meal.overrideServings}` : ""}&householdSize=${todaySummary?.householdSize ?? ""}`}>
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
                      <span className="text-muted-foreground italic">
                        {meal.customNote ?? "Freie Mahlzeit"}
                      </span>
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
                  {(() => {
                    const feedbackKey = `entry-${meal.id}`;
                    const given = feedbackGiven[feedbackKey];
                    return (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">Hat's geschmeckt?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 rounded-full transition-all ${given === "thumbs_up" ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-500"}`}
                          onClick={() => handleFeedback("thumbs_up", meal.id, meal.recipeId)}
                          disabled={!!given || feedbackMutation.isPending}
                          data-testid={`btn-thumbsup-${meal.mealType}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 rounded-full transition-all ${given === "neutral" ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-amber-500"}`}
                          onClick={() => handleFeedback("neutral", meal.id, meal.recipeId)}
                          disabled={!!given || feedbackMutation.isPending}
                          data-testid={`btn-neutral-${meal.mealType}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 rounded-full transition-all ${given === "thumbs_down" ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground hover:text-rose-500"}`}
                          onClick={() => handleFeedback("thumbs_down", meal.id, meal.recipeId)}
                          disabled={!!given || feedbackMutation.isPending}
                          data-testid={`btn-thumbsdown-${meal.mealType}`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>

          </>
        )}

        <div className="mt-8 pt-4 pb-4 space-y-3">
          {activePlan && (
            <Button
              className="w-full rounded-2xl h-14 text-base shadow-sm"
              variant="outline"
              onClick={handleGenerateList}
              disabled={generateList.isPending}
              data-testid="btn-generate-shopping-list"
            >
              {generateList.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="w-5 h-5 mr-2" />
              )}
              Einkaufsliste für diese Woche generieren
            </Button>
          )}
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
