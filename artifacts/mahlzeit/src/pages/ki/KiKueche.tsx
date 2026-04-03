import { useState } from "react";
import { useAiGenerateRecipe, useAiGeneratePlan, useAiSaveRecipe, useAiSubmitFeedback, useGetActiveMealPlan, useAddMealEntry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ChefHat, CalendarDays, Save, Clock, Users, CalendarPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AiRecipeOutput, AiPlanOutput } from "@workspace/api-client-react";

type Tab = "rezept" | "plan";

const MEAL_TYPE_OPTIONS = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagessen" },
  { value: "dinner", label: "Abendessen" },
  { value: "snack", label: "Snack" },
];

export default function KiKueche() {
  const [activeTab, setActiveTab] = useState<Tab>("rezept");
  const [recipePrompt, setRecipePrompt] = useState("");
  const [planPreferences, setPlanPreferences] = useState("");
  const [generatedRecipe, setGeneratedRecipe] = useState<AiRecipeOutput | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<AiPlanOutput | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<number | null>(null);
  const [showPlanInsert, setShowPlanInsert] = useState(false);
  const [insertDayId, setInsertDayId] = useState<number | null>(null);
  const [insertMealType, setInsertMealType] = useState("lunch");

  const { toast } = useToast();

  const activePlanQuery = useGetActiveMealPlan();
  const addEntryMutation = useAddMealEntry();

  const generateRecipeMutation = useAiGenerateRecipe({
    mutation: {
      onSuccess: (data) => {
        setGeneratedRecipe(data);
        setSavedRecipeId(null);
        setShowPlanInsert(false);
        toast({ title: "Rezept generiert!", description: data.name });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Rezept konnte nicht generiert werden.", variant: "destructive" });
      },
    },
  });

  const generatePlanMutation = useAiGeneratePlan({
    mutation: {
      onSuccess: (data) => {
        setGeneratedPlan(data);
        toast({ title: "Wochenplan generiert!", description: data.weekTitle });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Plan konnte nicht generiert werden.", variant: "destructive" });
      },
    },
  });

  const saveRecipeMutation = useAiSaveRecipe({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Gespeichert!", description: "Das Rezept wurde in deiner Sammlung gespeichert." });
        setSavedRecipeId(data.id);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Rezept konnte nicht gespeichert werden.", variant: "destructive" });
      },
    },
  });

  const handleGenerateRecipe = () => {
    if (!recipePrompt.trim()) return;
    generateRecipeMutation.mutate({ data: { prompt: recipePrompt } });
  };

  const handleGeneratePlan = () => {
    if (!planPreferences.trim()) return;
    generatePlanMutation.mutate({ data: { preferences: planPreferences } });
  };

  const handleSaveRecipe = () => {
    if (!generatedRecipe) return;
    saveRecipeMutation.mutate({ data: generatedRecipe });
  };

  const handleAddToActivePlan = () => {
    if (!savedRecipeId || !insertDayId || !activePlanQuery.data) return;
    addEntryMutation.mutate(
      { id: activePlanQuery.data.id, dayId: insertDayId, data: { mealType: insertMealType, recipeId: savedRecipeId } },
      {
        onSuccess: () => {
          toast({ title: "Zum Plan hinzugefügt!", description: "Das Rezept wurde deinem aktiven Plan hinzugefügt." });
          setShowPlanInsert(false);
          setGeneratedRecipe(null);
          setSavedRecipeId(null);
          setRecipePrompt("");
        },
        onError: () => {
          toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <div className="max-w-md mx-auto px-4">
        <div className="pt-10 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">KI-Küche</h1>
          </div>
          <p className="text-muted-foreground text-sm">Lass die KI für dich kochen und planen.</p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
          <button
            onClick={() => setActiveTab("rezept")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "rezept"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Rezept
          </button>
          <button
            onClick={() => setActiveTab("plan")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "plan"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Wochenplan
          </button>
        </div>

        {activeTab === "rezept" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="pt-5">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Was möchtest du kochen?
                </label>
                <Textarea
                  placeholder="z.B. Ein schnelles veganes Curry mit Kichererbsen und Kokosmilch..."
                  value={recipePrompt}
                  onChange={(e) => setRecipePrompt(e.target.value)}
                  className="resize-none min-h-[80px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerateRecipe();
                  }}
                />
                <Button
                  onClick={handleGenerateRecipe}
                  disabled={!recipePrompt.trim() || generateRecipeMutation.isPending}
                  className="w-full mt-3"
                >
                  {generateRecipeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generiere Rezept…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Rezept generieren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {generatedRecipe && (
              <>
              <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-display text-lg text-foreground leading-tight">
                      {generatedRecipe.name}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveRecipe}
                      disabled={saveRecipeMutation.isPending}
                      className="shrink-0 text-xs"
                    >
                      {saveRecipeMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" />
                          Speichern
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{generatedRecipe.description}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {generatedRecipe.servings} Portionen
                    </span>
                    {generatedRecipe.prepTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {generatedRecipe.prepTime} Min. Vorbereitung
                      </span>
                    )}
                    {generatedRecipe.cookTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {generatedRecipe.cookTime} Min. Kochen
                      </span>
                    )}
                  </div>
                  {generatedRecipe.tags && generatedRecipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {generatedRecipe.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Zutaten</h4>
                    <ul className="space-y-1">
                      {generatedRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">
                            {ing.amount} {ing.unit}
                          </span>
                          <span className="text-foreground">{ing.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Zubereitung</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {generatedRecipe.instructions}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {savedRecipeId && (
                <Card className="border-primary/20 bg-primary/5 animate-in fade-in duration-200">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">In aktiven Plan einfügen</p>
                    </div>
                    {!showPlanInsert ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowPlanInsert(true)}
                      >
                        <CalendarPlus className="w-3 h-3 mr-1" />
                        Plan-Tag auswählen
                      </Button>
                    ) : activePlanQuery.isLoading ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : !activePlanQuery.data ? (
                      <p className="text-xs text-muted-foreground">Kein aktiver Plan vorhanden. Erstelle zuerst einen Plan.</p>
                    ) : (
                      <div className="space-y-2">
                        <Select value={insertDayId?.toString() ?? ""} onValueChange={(v) => setInsertDayId(parseInt(v))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Tag wählen…" />
                          </SelectTrigger>
                          <SelectContent>
                            {activePlanQuery.data.days.sort((a, b) => a.dayNumber - b.dayNumber).map((day) => (
                              <SelectItem key={day.id} value={day.id.toString()} className="text-xs">
                                Tag {day.dayNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={insertMealType} onValueChange={setInsertMealType}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEAL_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={handleAddToActivePlan}
                          disabled={!insertDayId || addEntryMutation.isPending}
                        >
                          {addEntryMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <CalendarPlus className="w-3 h-3 mr-1" />
                          )}
                          Zum Plan hinzufügen
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              </>
            )}
          </div>
        )}

        {activeTab === "plan" && (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="pt-5">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Deine Ernährungspräferenzen
                </label>
                <Textarea
                  placeholder="z.B. Vegetarisch, keine Milchprodukte, viel Gemüse, schnelle Zubereitung..."
                  value={planPreferences}
                  onChange={(e) => setPlanPreferences(e.target.value)}
                  className="resize-none min-h-[80px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGeneratePlan();
                  }}
                />
                <Button
                  onClick={handleGeneratePlan}
                  disabled={!planPreferences.trim() || generatePlanMutation.isPending}
                  className="w-full mt-3"
                >
                  {generatePlanMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generiere Wochenplan…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Wochenplan generieren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {generatedPlan && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-foreground">{generatedPlan.weekTitle}</h3>
                </div>
                {generatedPlan.notes && (
                  <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                    {generatedPlan.notes}
                  </p>
                )}
                {generatedPlan.days.map((day, i) => (
                  <Card key={i} className="border-border/50">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-semibold text-foreground">{day.day}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      {day.meals.map((meal, j) => (
                        <div key={j} className="flex gap-3 items-start">
                          <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                            {meal.mealType}
                          </Badge>
                          <div>
                            <p className="text-sm font-medium text-foreground">{meal.suggestion}</p>
                            <p className="text-xs text-muted-foreground">{meal.description}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
