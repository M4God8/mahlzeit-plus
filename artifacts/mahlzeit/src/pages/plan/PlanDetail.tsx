import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetMealPlan,
  useActivateMealPlan,
  useCopyMealPlan,
  useUpdateMealPlan,
  useSwapMealPlanDays,
  useAddMealEntry,
  useUpdateMealEntry,
  useDeleteMealEntry,
  useDeleteMealPlan,
  useListRecipes,
  useGenerateShoppingList,
  useAiGeneratePlan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { MealPlanDetail, MealPlanDay, MealEntry, Recipe, AiPlanOutput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  Loader2,
  RefreshCw,
  Repeat2,
  ArrowLeftRight,
  Trash2,
  Zap,
  Plus,
  ChefHat,
  X,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const MEAL_TYPES = [
  { key: "breakfast", label: "Frühstück" },
  { key: "lunch", label: "Mittagessen" },
  { key: "dinner", label: "Abendessen" },
  { key: "snack", label: "Snack" },
] as const;

type MealTypeKey = typeof MEAL_TYPES[number]["key"];

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So", "Tag 8", "Tag 9", "Tag 10", "Tag 11", "Tag 12", "Tag 13", "Tag 14"];

function getMealEntry(day: MealPlanDay, mealType: string): MealEntry | undefined {
  return day.entries?.find(e => e.mealType === mealType);
}

interface RecipePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (recipe: Recipe) => void;
  title?: string;
}

function RecipePicker({ open, onClose, onPick, title = "Gericht wählen" }: RecipePickerProps) {
  const [search, setSearch] = useState("");
  const { data: recipes, isLoading } = useListRecipes({ search: search || undefined });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <input
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm mb-2 bg-background"
          placeholder="Rezept suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (recipes && recipes.length > 0) ? (
            recipes.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => { onPick(recipe); onClose(); }}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="font-semibold text-sm line-clamp-1">{recipe.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {recipe.prepTime + recipe.cookTime} min · {recipe.energyType}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8 text-sm">Keine Rezepte gefunden</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SwapDayPickerProps {
  open: boolean;
  onClose: () => void;
  plan: MealPlanDetail;
  sourceDayNumber: number;
  onSwap: (dayNumberB: number) => void;
}

function SwapDayPicker({ open, onClose, plan, sourceDayNumber, onSwap }: SwapDayPickerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Tag {sourceDayNumber} tauschen mit...</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {plan.days
            .filter(d => d.dayNumber !== sourceDayNumber)
            .sort((a, b) => a.dayNumber - b.dayNumber)
            .map(day => (
              <button
                key={day.id}
                onClick={() => { onSwap(day.dayNumber); onClose(); }}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <div className="font-semibold text-sm">{DAY_NAMES[day.dayNumber - 1] ?? `Tag ${day.dayNumber}`}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {day.entries?.length ?? 0} Gericht(e)
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanDetail() {
  const [, params] = useRoute("/plan/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const planId = params?.id ? parseInt(params.id) : NaN;

  const { data: plan, isLoading, isError } = useGetMealPlan(planId, {
    query: { queryKey: [`/api/meal-plans/${planId}`], enabled: !isNaN(planId) },
  });

  const activatePlan = useActivateMealPlan();
  const copyPlan = useCopyMealPlan();
  const updatePlan = useUpdateMealPlan();
  const swapDays = useSwapMealPlanDays();
  const addEntry = useAddMealEntry();
  const updateEntry = useUpdateMealEntry();
  const deleteEntry = useDeleteMealEntry();
  const deletePlan = useDeleteMealPlan();
  const generateList = useGenerateShoppingList();

  const [aiPlanDialogOpen, setAiPlanDialogOpen] = useState(false);
  const [aiPlanPreferences, setAiPlanPreferences] = useState("");
  const [generatedAiPlan, setGeneratedAiPlan] = useState<AiPlanOutput | null>(null);

  const aiGeneratePlanMutation = useAiGeneratePlan({
    mutation: {
      onSuccess: (data) => {
        setGeneratedAiPlan(data);
        toast({ title: "KI-Wochenplan generiert!", description: data.weekTitle });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Plan konnte nicht generiert werden.", variant: "destructive" });
      },
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ dayId: number; mealType: MealTypeKey; entryId?: number } | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSourceDay, setSwapSourceDay] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/meal-plans/${planId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/meal-plans/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/today"] });
  };

  const openPicker = (dayId: number, mealType: MealTypeKey, entryId?: number) => {
    setPickerTarget({ dayId, mealType, entryId });
    setPickerOpen(true);
  };

  const handlePickRecipe = (recipe: Recipe) => {
    if (!pickerTarget) return;
    if (pickerTarget.entryId) {
      updateEntry.mutate(
        { id: planId, dayId: pickerTarget.dayId, entryId: pickerTarget.entryId, data: { mealType: pickerTarget.mealType, recipeId: recipe.id } },
        { onSuccess: invalidatePlan, onError: () => toast({ title: "Fehler", variant: "destructive" }) }
      );
    } else {
      addEntry.mutate(
        { id: planId, dayId: pickerTarget.dayId, data: { mealType: pickerTarget.mealType, recipeId: recipe.id } },
        { onSuccess: invalidatePlan, onError: () => toast({ title: "Fehler", variant: "destructive" }) }
      );
    }
    setPickerTarget(null);
  };

  const handleRemoveEntry = (dayId: number, entryId: number) => {
    deleteEntry.mutate(
      { id: planId, dayId, entryId },
      { onSuccess: invalidatePlan, onError: () => toast({ title: "Fehler", variant: "destructive" }) }
    );
  };

  const handleActivate = () => {
    activatePlan.mutate(
      { id: planId },
      {
        onSuccess: () => { invalidatePlan(); toast({ title: "Plan aktiviert" }); },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  const handleCopyAsNewWeek = () => {
    copyPlan.mutate(
      { id: planId, data: { setActive: true } },
      {
        onSuccess: (newPlan) => {
          invalidatePlan();
          toast({ title: "Neue Woche erstellt", description: "Der Plan wurde für diese Woche kopiert und aktiviert." });
          if ("id" in newPlan) setLocation(`/plan/${(newPlan as { id: number }).id}`);
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  const handleToggleRepeat = (val: boolean) => {
    updatePlan.mutate(
      { id: planId, data: { repeatEnabled: val } },
      {
        onSuccess: invalidatePlan,
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  const handleSwap = (dayNumberB: number) => {
    if (!swapSourceDay) return;
    swapDays.mutate(
      { id: planId, data: { dayNumberA: swapSourceDay, dayNumberB } },
      {
        onSuccess: () => { invalidatePlan(); toast({ title: "Tage getauscht" }); },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deletePlan.mutate(
      { id: planId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
          toast({ title: "Plan gelöscht" });
          setLocation("/plan");
        },
        onError: () => toast({ title: "Fehler", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">Plan nicht gefunden.</p>
        <Button variant="outline" onClick={() => setLocation("/plan")}>Zurück</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 bg-background text-foreground animate-in fade-in">
      <header className="px-4 py-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => setLocation("/plan")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold truncate">{plan.title}</h2>
            <p className="text-xs text-muted-foreground">{plan.cycleLengthDays} Tage</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!plan.active && (
            <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={handleActivate} disabled={activatePlan.isPending} data-testid="btn-activate">
              <Zap className="w-3 h-3 mr-1" />
              Aktivieren
            </Button>
          )}
          {plan.active && (
            <Badge className="bg-primary/10 text-primary border-0 rounded-full text-xs px-2.5">Aktiv</Badge>
          )}
          <Button size="icon" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 space-y-5 max-w-2xl mx-auto w-full">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-full text-sm flex items-center gap-2"
            onClick={handleCopyAsNewWeek}
            disabled={copyPlan.isPending}
            data-testid="btn-copy-week"
          >
            {copyPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Diese Woche erneut
          </Button>

          <div className="flex items-center gap-2 bg-card border border-border/50 rounded-full px-4 py-2">
            <Repeat2 className="w-4 h-4 text-primary" />
            <Label htmlFor="loop-toggle" className="text-sm cursor-pointer">Loop</Label>
            <Switch
              id="loop-toggle"
              checked={plan.repeatEnabled}
              onCheckedChange={handleToggleRepeat}
              disabled={updatePlan.isPending}
              data-testid="switch-loop"
            />
          </div>

          {plan.active && (
            <Button
              variant="outline"
              className="rounded-full text-sm flex items-center gap-2"
              onClick={() => {
                generateList.mutate(undefined, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
                    toast({ title: "Einkaufsliste erstellt" });
                    setLocation("/einkauf");
                  },
                  onError: () => toast({ title: "Fehler beim Erstellen", variant: "destructive" }),
                });
              }}
              disabled={generateList.isPending}
              data-testid="btn-generate-shopping-list"
            >
              {generateList.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              Einkaufsliste generieren
            </Button>
          )}

          <Button
            variant="outline"
            className="rounded-full text-sm flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => { setGeneratedAiPlan(null); setAiPlanDialogOpen(true); }}
            data-testid="btn-ai-plan-suggestions"
          >
            <Sparkles className="w-4 h-4" />
            KI-Vorschläge
          </Button>
        </div>

        <div className="space-y-4">
          {plan.days.sort((a, b) => a.dayNumber - b.dayNumber).map((day) => (
            <Card key={day.id} className="overflow-hidden border-border/50 shadow-sm">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/30">
                <span className="font-display font-bold text-base">
                  {DAY_NAMES[day.dayNumber - 1] ?? `Tag ${day.dayNumber}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs rounded-full h-7 px-3 text-muted-foreground"
                  onClick={() => { setSwapSourceDay(day.dayNumber); setSwapOpen(true); }}
                  data-testid={`btn-swap-day-${day.dayNumber}`}
                >
                  <ArrowLeftRight className="w-3 h-3 mr-1" />
                  Tauschen
                </Button>
              </div>
              <CardContent className="p-3 space-y-2">
                {MEAL_TYPES.map(({ key, label }) => {
                  const entry = getMealEntry(day, key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${entry ? "bg-primary/5 border border-primary/10" : "bg-muted/40 border border-dashed border-border/50"}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-0.5">{label}</div>
                        {entry?.recipe ? (
                          <div className="text-sm font-medium truncate">{entry.recipe.title}</div>
                        ) : entry?.customNote ? (
                          <div className="text-sm italic text-muted-foreground truncate">{entry.customNote}</div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">Leer</div>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-full"
                          onClick={() => openPicker(day.id, key as MealTypeKey, entry?.id)}
                          data-testid={`btn-assign-${day.dayNumber}-${key}`}
                        >
                          {entry ? <ChefHat className="w-3.5 h-3.5 text-primary" /> : <Plus className="w-3.5 h-3.5" />}
                        </Button>
                        {entry && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveEntry(day.id, entry.id)}
                            data-testid={`btn-remove-${day.dayNumber}-${key}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <RecipePicker
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
        onPick={handlePickRecipe}
        title={pickerTarget ? `Gericht für ${MEAL_TYPES.find(m => m.key === pickerTarget.mealType)?.label ?? pickerTarget.mealType}` : "Gericht wählen"}
      />

      {plan && swapSourceDay !== null && (
        <SwapDayPicker
          open={swapOpen}
          onClose={() => { setSwapOpen(false); setSwapSourceDay(null); }}
          plan={plan as MealPlanDetail}
          sourceDayNumber={swapSourceDay}
          onSwap={handleSwap}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Plan löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{plan.title}" wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={aiPlanDialogOpen} onOpenChange={setAiPlanDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Sparkles className="w-4 h-4 text-primary" />
              KI-Wochenplan-Vorschläge
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Deine Wünsche</label>
              <Textarea
                placeholder="z.B. Viel Gemüse, wenig Fleisch, schnelle Zubereitung, saisonal..."
                value={aiPlanPreferences}
                onChange={(e) => setAiPlanPreferences(e.target.value)}
                className="resize-none min-h-[80px] text-sm"
              />
            </div>
            <Button
              onClick={() => aiGeneratePlanMutation.mutate({ preferences: aiPlanPreferences })}
              disabled={!aiPlanPreferences.trim() || aiGeneratePlanMutation.isPending}
              className="w-full"
              data-testid="btn-ai-generate-plan"
            >
              {aiGeneratePlanMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generiere…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Vorschläge generieren</>
              )}
            </Button>

            {generatedAiPlan && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <p className="text-sm font-semibold text-foreground">{generatedAiPlan.weekTitle}</p>
                {generatedAiPlan.notes && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{generatedAiPlan.notes}</p>
                )}
                {generatedAiPlan.days.map((day, i) => (
                  <div key={i} className="border border-border/50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-foreground">{day.day}</p>
                    {day.meals.map((meal, j) => (
                      <div key={j} className="flex gap-2 items-start">
                        <Badge variant="outline" className="text-xs shrink-0">{meal.mealType}</Badge>
                        <div>
                          <p className="text-xs font-medium text-foreground">{meal.suggestion}</p>
                          <p className="text-xs text-muted-foreground">{meal.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
