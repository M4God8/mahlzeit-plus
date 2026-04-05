import { useState } from "react";
import {
  useListRecipes,
  useAiGenerateRecipe,
  useAiSaveRecipe,
} from "@workspace/api-client-react";
import type { Recipe, AiRecipeOutput, AiIngredient } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ChefHat, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface RecipePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (recipe: Recipe) => void;
  title?: string;
}

type TabKey = "all" | "mine" | "ai";

const KOCHZEIT_OPTIONS = [
  { label: "Alle", value: "" },
  { label: "bis 15 Min", value: "15" },
  { label: "bis 30 Min", value: "30" },
];

const ENERGIE_OPTIONS = [
  { label: "Alle", value: "" },
  { label: "leicht", value: "leicht" },
  { label: "sättigend", value: "sättigend" },
  { label: "schnell", value: "schnell" },
];

function RecipeList({
  mine,
  search,
  maxTime,
  energyType,
  onPick,
  onClose,
}: {
  mine: boolean;
  search: string;
  maxTime: string;
  energyType: string;
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { data: recipes, isLoading } = useListRecipes({
    search: search || undefined,
    maxTime: maxTime ? Number(maxTime) : undefined,
    energyType: energyType || undefined,
    mine: mine || undefined,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (mine && (!recipes || recipes.length === 0)) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          Noch keine eigenen Rezepte — erstelle dein erstes Rezept
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onClose();
            navigate("/rezepte");
          }}
        >
          <ExternalLink className="w-4 h-4 mr-1.5" />
          Zu meinen Rezepten
        </Button>
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Keine Rezepte gefunden
      </div>
    );
  }

  return (
    <>
      {recipes.map((recipe: Recipe) => (
        <button
          key={recipe.id}
          onClick={() => {
            onPick(recipe);
            onClose();
          }}
          className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <div className="font-semibold text-sm line-clamp-1">
            {recipe.title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {recipe.prepTime + recipe.cookTime} min · {recipe.energyType}
          </div>
        </button>
      ))}
    </>
  );
}

function AiSuggestionTab({
  onPick,
  onClose,
}: {
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [generatedRecipe, setGeneratedRecipe] = useState<AiRecipeOutput | null>(null);
  const generateMutation = useAiGenerateRecipe();
  const saveMutation = useAiSaveRecipe();

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setGeneratedRecipe(null);
    generateMutation.mutate(
      { data: { prompt: prompt.trim() } },
      {
        onSuccess: (data: AiRecipeOutput) => {
          setGeneratedRecipe(data);
        },
      }
    );
  };

  const handleInsertInPlan = () => {
    if (!generatedRecipe) return;
    saveMutation.mutate(
      { data: generatedRecipe },
      {
        onSuccess: (savedRecipe: Recipe) => {
          onPick(savedRecipe);
          onClose();
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background"
          placeholder="Was soll ich heute frühstücken?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isPending}
          className="w-full"
          size="sm"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1.5" />
          )}
          Rezept generieren
        </Button>
      </div>

      {generateMutation.isError && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-xl p-3">
          Fehler bei der Generierung. Bitte versuche es erneut.
        </div>
      )}

      {generatedRecipe && (
        <div className="border border-primary/30 rounded-xl p-3 space-y-2 bg-primary/5">
          <div className="flex items-start gap-2">
            <ChefHat className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-sm">{generatedRecipe.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {generatedRecipe.description}
              </div>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            {generatedRecipe.prepTime != null && (
              <span>Vorbereitung: {generatedRecipe.prepTime} min</span>
            )}
            {generatedRecipe.cookTime != null && (
              <span>Kochzeit: {generatedRecipe.cookTime} min</span>
            )}
            {generatedRecipe.servings && (
              <span>{generatedRecipe.servings} Portionen</span>
            )}
          </div>
          {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Zutaten: </span>
              {generatedRecipe.ingredients.map((i: AiIngredient) => `${i.amount} ${i.unit} ${i.name}`).join(", ")}
            </div>
          )}
          {generatedRecipe.tags && generatedRecipe.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {generatedRecipe.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <Button
            onClick={handleInsertInPlan}
            disabled={saveMutation.isPending}
            className="w-full"
            size="sm"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : null}
            In Plan einfügen
          </Button>
        </div>
      )}
    </div>
  );
}

export function RecipePicker({
  open,
  onClose,
  onPick,
  title = "Gericht wählen",
}: RecipePickerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [maxTime, setMaxTime] = useState("");
  const [energyType, setEnergyType] = useState("");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "Alle Rezepte" },
    { key: "mine", label: "Meine Rezepte" },
    { key: "ai", label: "KI-Vorschlag" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border mb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-xs font-medium py-2 transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "ai" && (
          <div className="space-y-2 mb-2">
            <input
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-background"
              placeholder="Rezept suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
                className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
              >
                {KOCHZEIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Kochzeit: {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={energyType}
                onChange={(e) => setEnergyType(e.target.value)}
                className="flex-1 border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
              >
                {ENERGIE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Energie: {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {activeTab === "ai" ? (
            <AiSuggestionTab onPick={onPick} onClose={onClose} />
          ) : (
            <RecipeList
              mine={activeTab === "mine"}
              search={search}
              maxTime={maxTime}
              energyType={energyType}
              onPick={onPick}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
