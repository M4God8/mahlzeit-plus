import { useState, useEffect } from "react";
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
  useGenerateShoppingList,
  useAiGeneratePlan,
  useAiGenerateRecipe,
} from "@workspace/api-client-react";
import { RecipePicker } from "@/components/RecipePicker";
import { useQueryClient } from "@tanstack/react-query";
import type { MealPlanDetail, MealPlanDay, MealEntry, Recipe, AiPlanOutput, AiRecipeOutput } from "@workspace/api-client-react";
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
  PlusCircle,
  ChefHat,
  X,
  ShoppingCart,
  Sparkles,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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

const COOK_TIME_STEPS = [10, 15, 30, 45, 60, 90];

function CookTimeSliderModal({ open, onClose, onSelect, currentValue }: {
  open: boolean;
  onClose: () => void;
  onSelect: (minutes: number | null) => void;
  currentValue: number | null;
}) {
  const [sliderIdx, setSliderIdx] = useState(2);

  useEffect(() => {
    const idx = COOK_TIME_STEPS.indexOf(currentValue ?? 30);
    setSliderIdx(idx >= 0 ? idx : 2);
  }, [currentValue, open]);

  const selectedMinutes = COOK_TIME_STEPS[sliderIdx] ?? 30;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-xs mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Clock className="w-4 h-4 text-primary" />
            Kochzeit anpassen
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="text-center">
            <span className="font-mono text-4xl font-bold text-primary">{selectedMinutes}</span>
            <span className="text-lg text-muted-foreground ml-1">Min</span>
          </div>
          <Slider
            value={[sliderIdx]}
            min={0}
            max={COOK_TIME_STEPS.length - 1}
            step={1}
            onValueChange={(v) => setSliderIdx(v[0])}
            className="py-2"
            data-testid="slider-cooktime"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono px-1">
            {COOK_TIME_STEPS.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <Button
            className="w-full rounded-full"
            onClick={() => onSelect(selectedMinutes)}
            data-testid="btn-cooktime-confirm"
          >
            Übernehmen
          </Button>
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground rounded-full"
            onClick={() => onSelect(null)}
            data-testid="btn-cooktime-reset"
          >
            Standard verwenden
          </Button>
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
  const [materializingPlan, setMaterializingPlan] = useState(false);

  const MEAL_TYPE_MAP: Record<string, string> = {
    "Frühstück": "breakfast",
    "Mittagessen": "lunch",
    "Abendessen": "dinner",
    "Snack": "snack",
  };

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

  const handleMaterializePlan = async () => {
    if (!generatedAiPlan || !plan) return;
    setMaterializingPlan(true);
    try {
      const sortedDays = [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber);
      for (let i = 0; i < Math.min(generatedAiPlan.days.length, sortedDays.length); i++) {
        const aiDay = generatedAiPlan.days[i]!;
        const planDay = sortedDays[i]!;
        for (const meal of aiDay.meals) {
          const mealType = MEAL_TYPE_MAP[meal.mealType] ?? "lunch";
          const customNote = `${meal.suggestion}: ${meal.description}`;
          await new Promise<void>((resolve) => {
            addEntry.mutate(
              { id: planId, dayId: planDay.id, data: { mealType, customNote, recipeId: null } },
              { onSettled: () => resolve() }
            );
          });
        }
      }
      toast({ title: "Plan eingefügt!", description: "KI-Vorschläge wurden als Notizen in deinen Plan eingefügt." });
      queryClient.invalidateQueries({ queryKey: [`/api/meal-plans/${planId}`] });
      setAiPlanDialogOpen(false);
      setGeneratedAiPlan(null);
    } catch {
      toast({ title: "Fehler beim Einfügen", variant: "destructive" });
    } finally {
      setMaterializingPlan(false);
    }
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ dayId: number; mealType: MealTypeKey; entryId?: number } | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSourceDay, setSwapSourceDay] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cookTimeModalOpen, setCookTimeModalOpen] = useState(false);
  const [cookTimeTarget, setCookTimeTarget] = useState<{ dayId: number; entries: MealEntry[] } | null>(null);
  const [alternativeModalOpen, setAlternativeModalOpen] = useState(false);
  const [alternativeTarget, setAlternativeTarget] = useState<{ dayId: number; entryId: number; mealType: string } | null>(null);
  const [alternativeGenerating, setAlternativeGenerating] = useState(false);
  const [generatedAlternative, setGeneratedAlternative] = useState<AiRecipeOutput | null>(null);

  const aiGenerateRecipeMutation = useAiGenerateRecipe();

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

  const handleSetCookTimeOverride = (minutes: number | null) => {
    if (!cookTimeTarget) return;
    const promises = cookTimeTarget.entries.map(
      (entry) =>
        new Promise<void>((resolve) => {
          updateEntry.mutate(
            {
              id: planId,
              dayId: cookTimeTarget.dayId,
              entryId: entry.id,
              data: { mealType: entry.mealType, recipeId: entry.recipeId ?? null, customNote: entry.customNote ?? null, overrideCookTime: minutes },
            },
            { onSettled: () => resolve() }
          );
        })
    );
    Promise.all(promises).then(() => {
      invalidatePlan();
      toast({ title: minutes ? `Kochzeit auf ${minutes} Min angepasst` : "Kochzeit-Override entfernt" });
      setCookTimeModalOpen(false);
      setCookTimeTarget(null);
    });
  };

  const MEAL_TYPE_LABEL: Record<string, string> = {
    breakfast: "Frühstück",
    lunch: "Mittagessen",
    dinner: "Abendessen",
    snack: "Snack",
  };

  const handleAlternativeWithTime = (minutes: number) => {
    if (!alternativeTarget || !plan) return;
    const day = plan.days.find(d => d.id === alternativeTarget.dayId);
    const entry = day?.entries?.find(e => e.id === alternativeTarget.entryId);
    if (!entry) return;

    setAlternativeGenerating(true);
    setGeneratedAlternative(null);

    updateEntry.mutate(
      {
        id: planId,
        dayId: alternativeTarget.dayId,
        entryId: alternativeTarget.entryId,
        data: {
          mealType: entry.mealType,
          recipeId: entry.recipeId ?? null,
          customNote: entry.customNote ?? null,
          overrideCookTime: minutes,
        },
      },
      {
        onSuccess: () => {
          invalidatePlan();
          const currentName = entry.recipe?.title ?? entry.customNote ?? "";
          const mealLabel = MEAL_TYPE_LABEL[entry.mealType] ?? entry.mealType;
          aiGenerateRecipeMutation.mutate(
            {
              data: {
                prompt: `Eine Alternative für ${mealLabel}${currentName ? ` (statt "${currentName}")` : ""}. Maximale Zubereitungszeit: ${minutes} Minuten.`,
              },
            },
            {
              onSuccess: (data) => {
                setGeneratedAlternative(data);
                setAlternativeGenerating(false);
                toast({ title: "Alternative generiert!" });
              },
              onError: () => {
                setAlternativeGenerating(false);
                toast({ title: "Fehler bei KI-Generierung", variant: "destructive" });
              },
            }
          );
        },
        onError: () => {
          setAlternativeGenerating(false);
          toast({ title: "Fehler", variant: "destructive" });
        },
      }
    );
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
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base">
                    {DAY_NAMES[day.dayNumber - 1] ?? `Tag ${day.dayNumber}`}
                  </span>
                  {day.entries?.some(e => e.overrideCookTime) && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 border-primary/30 text-primary">
                      <Clock className="w-2.5 h-2.5" />
                      {day.entries.find(e => e.overrideCookTime)?.overrideCookTime} Min
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs rounded-full h-7 px-2 text-muted-foreground"
                    onClick={() => { setCookTimeTarget({ dayId: day.id, entries: day.entries ?? [] }); setCookTimeModalOpen(true); }}
                    data-testid={`btn-time-override-${day.dayNumber}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Zeit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs rounded-full h-7 px-2 text-muted-foreground"
                    onClick={() => { setSwapSourceDay(day.dayNumber); setSwapOpen(true); }}
                    data-testid={`btn-swap-day-${day.dayNumber}`}
                  >
                    <ArrowLeftRight className="w-3 h-3 mr-1" />
                    Tauschen
                  </Button>
                </div>
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
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-full text-muted-foreground hover:text-primary"
                              onClick={() => { setAlternativeTarget({ dayId: day.id, entryId: entry.id, mealType: entry.mealType }); setAlternativeModalOpen(true); }}
                              data-testid={`btn-alt-${day.dayNumber}-${key}`}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 rounded-full text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveEntry(day.id, entry.id)}
                              data-testid={`btn-remove-${day.dayNumber}-${key}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
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
              onClick={() => aiGeneratePlanMutation.mutate({ data: { preferences: aiPlanPreferences } })}
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{generatedAiPlan.weekTitle}</p>
                  <Button
                    size="sm"
                    onClick={handleMaterializePlan}
                    disabled={materializingPlan}
                    className="text-xs"
                    data-testid="btn-materialize-plan"
                  >
                    {materializingPlan ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Einfügen…</>
                    ) : (
                      <><PlusCircle className="w-3 h-3 mr-1" />In Plan einfügen</>
                    )}
                  </Button>
                </div>
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

      <CookTimeSliderModal
        open={cookTimeModalOpen}
        onClose={() => { setCookTimeModalOpen(false); setCookTimeTarget(null); }}
        onSelect={handleSetCookTimeOverride}
        currentValue={cookTimeTarget?.entries?.find(e => e.overrideCookTime)?.overrideCookTime ?? null}
      />

      <Dialog open={alternativeModalOpen} onOpenChange={(v) => { if (!v) { setAlternativeModalOpen(false); setAlternativeTarget(null); setGeneratedAlternative(null); setAlternativeGenerating(false); } }}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Alternative generieren</DialogTitle>
          </DialogHeader>
          {!generatedAlternative && !alternativeGenerating && (
            <div className="space-y-2 py-2">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl justify-start gap-3 text-sm"
                onClick={() => handleAlternativeWithTime(15)}
                data-testid="btn-alt-quick"
              >
                <span className="text-lg">⚡</span>
                Schnelle Version (15 Min)
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl justify-start gap-3 text-sm"
                onClick={() => handleAlternativeWithTime(60)}
                data-testid="btn-alt-leisurely"
              >
                <span className="text-lg">🍳</span>
                Mit mehr Zeit (60 Min)
              </Button>
            </div>
          )}
          {alternativeGenerating && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">KI generiert Alternative…</p>
            </div>
          )}
          {generatedAlternative && (
            <div className="space-y-3 py-2 animate-in fade-in">
              <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-2">
                <h4 className="font-display font-bold text-lg">{generatedAlternative.name}</h4>
                <p className="text-sm text-muted-foreground">{generatedAlternative.description}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{(generatedAlternative.prepTime ?? 0) + (generatedAlternative.cookTime ?? 0)} Min</span>
                  <span>·</span>
                  <span>{generatedAlternative.servings} Portionen</span>
                </div>
              </div>
              <Button
                className="w-full rounded-full"
                onClick={() => {
                  if (!alternativeTarget) return;
                  const day = plan?.days.find(d => d.id === alternativeTarget.dayId);
                  const entry = day?.entries?.find(e => e.id === alternativeTarget.entryId);
                  if (!entry) return;
                  updateEntry.mutate(
                    {
                      id: planId,
                      dayId: alternativeTarget.dayId,
                      entryId: alternativeTarget.entryId,
                      data: {
                        mealType: entry.mealType,
                        customNote: `${generatedAlternative.name}: ${generatedAlternative.description}`,
                        overrideCookTime: entry.overrideCookTime ?? null,
                      },
                    },
                    {
                      onSuccess: () => {
                        invalidatePlan();
                        toast({ title: "Alternative übernommen!" });
                        setAlternativeModalOpen(false);
                        setAlternativeTarget(null);
                        setGeneratedAlternative(null);
                      },
                      onError: () => toast({ title: "Fehler", variant: "destructive" }),
                    }
                  );
                }}
                data-testid="btn-accept-alternative"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Übernehmen
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
