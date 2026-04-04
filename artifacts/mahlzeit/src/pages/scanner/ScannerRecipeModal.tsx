import { useState, useCallback, useEffect, useRef } from "react";
import { useCreateRecipeFromProduct, useCreateRecipe } from "@workspace/api-client-react";
import type { AiRecipeOutput, AiIngredient } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ChefHat,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ShoppingCart,
  Pencil,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScannerRecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  barcode: string;
  ingredients: string;
  onRecipeSaved?: () => void;
  onGoToShoppingList?: () => void;
}

type Step = "loading" | "preview" | "editing" | "error";

export default function ScannerRecipeModal({
  open,
  onOpenChange,
  productName,
  barcode,
  ingredients,
  onRecipeSaved,
  onGoToShoppingList,
}: ScannerRecipeModalProps) {
  const [step, setStep] = useState<Step>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [editableRecipe, setEditableRecipe] = useState<AiRecipeOutput | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const { toast } = useToast();

  const generateMutation = useCreateRecipeFromProduct();
  const createRecipeMutation = useCreateRecipe();
  const generationTriggered = useRef(false);

  useEffect(() => {
    if (open && !hasStarted && !generationTriggered.current) {
      generationTriggered.current = true;
      setHasStarted(true);
      setStep("loading");
      setErrorMessage("");

      generateMutation.mutate(
        { data: { barcode, productName, ingredients } },
        {
          onSuccess: (data) => {
            setEditableRecipe(data);
            setStep("preview");
          },
          onError: (err: unknown) => {
            let errorMsg = "KI-Rezepterstellung fehlgeschlagen. Bitte erneut versuchen.";
            if (err && typeof err === "object" && "data" in err) {
              const data = (err as { data: { error?: string } | null }).data;
              if (data?.error) errorMsg = data.error;
            }
            setErrorMessage(errorMsg);
            setStep("error");
          },
        }
      );
    }
  }, [open, hasStarted, barcode, productName, ingredients, generateMutation]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setHasStarted(false);
        generationTriggered.current = false;
        setStep("loading");
        setEditableRecipe(null);
        setErrorMessage("");
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  const handleRetry = useCallback(() => {
    generationTriggered.current = false;
    setHasStarted(false);
    setStep("loading");
    setEditableRecipe(null);
    setErrorMessage("");
  }, []);

  const updateRecipeField = useCallback(
    <K extends keyof AiRecipeOutput>(field: K, value: AiRecipeOutput[K]) => {
      setEditableRecipe((prev) => (prev ? { ...prev, [field]: value } : null));
    },
    []
  );

  const updateIngredient = useCallback(
    (index: number, field: keyof AiIngredient, value: string) => {
      setEditableRecipe((prev) => {
        if (!prev) return null;
        const newIngredients = [...prev.ingredients];
        newIngredients[index] = { ...newIngredients[index]!, [field]: value };
        return { ...prev, ingredients: newIngredients };
      });
    },
    []
  );

  const removeIngredient = useCallback((index: number) => {
    setEditableRecipe((prev) => {
      if (!prev) return null;
      return { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) };
    });
  }, []);

  const addIngredient = useCallback(() => {
    setEditableRecipe((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ingredients: [...prev.ingredients, { name: "", amount: "", unit: "g" }],
      };
    });
  }, []);

  const saveRecipe = useCallback(
    (goToShoppingList: boolean) => {
      if (!editableRecipe) return;

      createRecipeMutation.mutate(
        {
          data: {
            title: editableRecipe.name,
            description: editableRecipe.description || "",
            prepTime: editableRecipe.prepTime ?? 10,
            cookTime: editableRecipe.cookTime ?? 20,
            servings: editableRecipe.servings,
            instructions: editableRecipe.instructions,
            tags: editableRecipe.tags ?? [],
            energyType: "leicht",
            isPublic: false,
            ingredients: editableRecipe.ingredients.map((ing) => ({
              customName: ing.name,
              amount: parseFloat(ing.amount) || 0,
              unit: ing.unit,
              optional: false,
            })),
            source: "scanner_inspired",
            sourceNote: `Inspiriert von: ${productName}`,
          } as Parameters<typeof createRecipeMutation.mutate>[0]["data"],
        },
        {
          onSuccess: () => {
            toast({
              title: "Rezept gespeichert!",
              description: `Dein Heimrezept inspiriert von "${productName}" wurde gespeichert.`,
            });
            handleOpenChange(false);
            onRecipeSaved?.();
            if (goToShoppingList) {
              onGoToShoppingList?.();
            }
          },
          onError: () => {
            toast({
              title: "Fehler",
              description: "Das Rezept konnte nicht gespeichert werden.",
              variant: "destructive",
            });
          },
        }
      );
    },
    [editableRecipe, productName, createRecipeMutation, toast, handleOpenChange, onRecipeSaved, onGoToShoppingList]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Selbst machen
          </DialogTitle>
          <DialogDescription className="sr-only">
            KI-generiertes Heimrezept basierend auf dem gescannten Produkt.
          </DialogDescription>
        </DialogHeader>

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">
              Ich erstelle dir ein verbessertes Heimrezept
              <br />
              von <span className="font-medium text-foreground">{productName}</span>...
            </p>
            <p className="text-xs text-muted-foreground/60">Das kann einen Moment dauern.</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Nochmal versuchen
            </Button>
          </div>
        )}

        {(step === "preview" || step === "editing") && editableRecipe && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
              <ChefHat className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Inspiriert von <span className="font-medium">{productName}</span> — mit natürlichen Zutaten neu gedacht.
              </p>
            </div>

            {step === "editing" ? (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Rezeptname
                  </label>
                  <Input
                    value={editableRecipe.name}
                    onChange={(e) => updateRecipeField("name", e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Beschreibung
                  </label>
                  <Textarea
                    value={editableRecipe.description}
                    onChange={(e) => updateRecipeField("description", e.target.value)}
                    className="resize-none min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Portionen
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={editableRecipe.servings}
                      onChange={(e) => updateRecipeField("servings", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Vorbereitung
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={editableRecipe.prepTime ?? 0}
                      onChange={(e) => updateRecipeField("prepTime", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Kochen
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={editableRecipe.cookTime ?? 0}
                      onChange={(e) => updateRecipeField("cookTime", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Zutaten
                  </label>
                  <Card className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                      {editableRecipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex gap-1 items-center">
                          <Input
                            placeholder="Menge"
                            value={ing.amount}
                            onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                            className="w-16 text-xs h-8"
                          />
                          <Input
                            placeholder="Einheit"
                            value={ing.unit}
                            onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                            className="w-14 text-xs h-8"
                          />
                          <Input
                            placeholder="Zutat"
                            value={ing.name}
                            onChange={(e) => updateIngredient(i, "name", e.target.value)}
                            className="flex-1 text-xs h-8"
                          />
                          <button
                            onClick={() => removeIngredient(i)}
                            className="text-muted-foreground hover:text-destructive p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7"
                        onClick={addIngredient}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Zutat hinzufügen
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Zubereitung
                  </label>
                  <Textarea
                    value={editableRecipe.instructions}
                    onChange={(e) => updateRecipeField("instructions", e.target.value)}
                    className="resize-none min-h-[100px] text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {(editableRecipe.tags ?? []).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        {tag}
                        <button
                          onClick={() =>
                            updateRecipeField(
                              "tags",
                              (editableRecipe.tags ?? []).filter((_, j) => j !== i)
                            )
                          }
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Neuen Tag eingeben und Enter drücken"
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = (e.target as HTMLInputElement).value.trim();
                        if (value) {
                          updateRecipeField("tags", [...(editableRecipe.tags ?? []), value]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <h3 className="font-display font-bold text-lg">{editableRecipe.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{editableRecipe.description}</p>
                </div>

                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {editableRecipe.servings} Portionen
                  </span>
                  {editableRecipe.prepTime != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {editableRecipe.prepTime} Min. Vorb.
                    </span>
                  )}
                  {editableRecipe.cookTime != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {editableRecipe.cookTime} Min. Kochen
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Zutaten</label>
                  <Card className="border-border/50">
                    <CardContent className="p-3">
                      <ul className="space-y-1">
                        {editableRecipe.ingredients.map((ing, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{ing.amount} {ing.unit}</span>{" "}
                            {ing.name}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Zubereitung</label>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{editableRecipe.instructions}</p>
                </div>

                {editableRecipe.tags && editableRecipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {editableRecipe.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {step === "editing" ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("preview")}
                  >
                    Zurück
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => saveRecipe(false)}
                    disabled={createRecipeMutation.isPending || !editableRecipe.name}
                  >
                    {createRecipeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Speichern
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    onClick={() => saveRecipe(false)}
                    disabled={createRecipeMutation.isPending}
                  >
                    {createRecipeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Rezept speichern
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => saveRecipe(true)}
                    disabled={createRecipeMutation.isPending}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Direkt zur Einkaufsliste
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setStep("editing")}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Erst bearbeiten
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
