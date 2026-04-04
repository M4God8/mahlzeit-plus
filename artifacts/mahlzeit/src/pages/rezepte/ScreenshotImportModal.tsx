import { useState, useRef, useCallback, useEffect } from "react";
import { useImportRecipeScreenshot, useCreateRecipe } from "@workspace/api-client-react";
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
  Camera,
  ImagePlus,
  X,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Save,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AiRecipeOutput, AiIngredient } from "@workspace/api-client-react";

const CACHE_KEY = "mahlzeit_import_recipe_draft";

interface ScreenshotImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecipeSaved?: () => void;
}

type Step = "upload" | "loading" | "preview" | "error";

function isUncertain(value: string | undefined | null): boolean {
  return value === "?" || value === "??" || value === "";
}

function loadCachedDraft(): { recipe: AiRecipeOutput; sourceNote: string } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.recipe?.name) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveDraft(recipe: AiRecipeOutput | null, sourceNote: string) {
  if (!recipe) {
    sessionStorage.removeItem(CACHE_KEY);
    return;
  }
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ recipe, sourceNote }));
}

function clearDraft() {
  sessionStorage.removeItem(CACHE_KEY);
}

export default function ScreenshotImportModal({
  open,
  onOpenChange,
  onRecipeSaved,
}: ScreenshotImportModalProps) {
  const cached = loadCachedDraft();
  const [step, setStep] = useState<Step>(cached ? "preview" : "upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [editableRecipe, setEditableRecipe] = useState<AiRecipeOutput | null>(cached?.recipe ?? null);
  const [sourceNote, setSourceNote] = useState(cached?.sourceNote ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const importMutation = useImportRecipeScreenshot();
  const createRecipeMutation = useCreateRecipe();

  useEffect(() => {
    if (editableRecipe) {
      saveDraft(editableRecipe, sourceNote);
    }
  }, [editableRecipe, sourceNote]);

  const resetState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStep("upload");
    setSelectedFiles([]);
    setPreviews([]);
    setErrorMessage("");
    setEditableRecipe(null);
    setSourceNote("");
    clearDraft();
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && step === "loading") {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      }
      if (!isOpen && step !== "preview") {
        resetState();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetState, step]
  );

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).slice(0, 5);
    setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 5));
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, 5));
  }, []);

  const removeFile = useCallback(
    (index: number) => {
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
      URL.revokeObjectURL(previews[index]!);
      setPreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [previews]
  );

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStep("upload");
    setErrorMessage("");
  }, []);

  const handleAnalyze = useCallback(() => {
    if (selectedFiles.length === 0) return;

    setStep("loading");
    setErrorMessage("");

    abortControllerRef.current = new AbortController();

    const formData = { images: selectedFiles as Blob[] };

    importMutation.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          abortControllerRef.current = null;
          setEditableRecipe(data);
          setStep("preview");
        },
        onError: (err: unknown) => {
          abortControllerRef.current = null;
          if (err instanceof DOMException && err.name === "AbortError") {
            setStep("upload");
            return;
          }
          let errorMsg = "Fehler beim Analysieren des Screenshots.";
          if (err && typeof err === "object" && "data" in err) {
            const data = (err as { data: { error?: string } | null }).data;
            if (data?.error) errorMsg = data.error;
          }
          setErrorMessage(errorMsg);
          setStep("error");
        },
      }
    );
  }, [selectedFiles, importMutation]);

  const handleRetry = useCallback(() => {
    setStep("upload");
    setEditableRecipe(null);
    setSelectedFiles([]);
    setPreviews([]);
    setErrorMessage("");
    setSourceNote("");
    clearDraft();
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

  const handleSaveRecipe = useCallback(() => {
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
          source: "screenshot",
          sourceNote: sourceNote || undefined,
        } as Parameters<typeof createRecipeMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          toast({
            title: "Rezept gespeichert!",
            description: "Das importierte Rezept wurde deiner Sammlung hinzugefügt.",
          });
          clearDraft();
          handleClose(false);
          onRecipeSaved?.();
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
  }, [editableRecipe, sourceNote, createRecipeMutation, toast, handleClose, onRecipeSaved]);

  const hasDraft = !!loadCachedDraft();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Rezept aus Screenshot importieren
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lade einen Screenshot eines Rezepts hoch, um es automatisch zu importieren.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {hasDraft && !editableRecipe && (
              <button
                onClick={() => {
                  const draft = loadCachedDraft();
                  if (draft) {
                    setEditableRecipe(draft.recipe);
                    setSourceNote(draft.sourceNote);
                    setStep("preview");
                  }
                }}
                className="w-full p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-left"
              >
                <span className="font-medium text-primary">Entwurf vorhanden</span>
                <br />
                <span className="text-muted-foreground">Dein letztes analysiertes Rezept ist noch da. Tippe hier, um es weiterzubearbeiten.</span>
              </button>
            )}

            <p className="text-sm text-muted-foreground">
              Lade einen Screenshot eines Rezepts hoch (z.B. von TikTok, Instagram oder
              einer Kochseite). Die KI analysiert das Bild und extrahiert alle
              Rezeptdaten.
            </p>

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                Foto-Bibliothek
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Kamera
              </Button>
            </div>

            <Button
              className="w-full"
              disabled={selectedFiles.length === 0}
              onClick={handleAnalyze}
            >
              Rezept analysieren
            </Button>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">
              Die KI analysiert den Screenshot…
              <br />
              Das kann einen Moment dauern.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="mt-2"
            >
              <X className="w-4 h-4 mr-2" />
              Abbrechen
            </Button>
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

        {step === "preview" && editableRecipe && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Rezeptname
              </label>
              <Input
                value={editableRecipe.name}
                onChange={(e) => updateRecipeField("name", e.target.value)}
                className={isUncertain(editableRecipe.name) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Beschreibung
              </label>
              <Textarea
                value={editableRecipe.description}
                onChange={(e) => updateRecipeField("description", e.target.value)}
                className={`resize-none min-h-[60px] ${isUncertain(editableRecipe.description) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
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
                        className={`w-16 text-xs h-8 ${isUncertain(ing.amount) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                      />
                      <Input
                        placeholder="Einheit"
                        value={ing.unit}
                        onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                        className={`w-14 text-xs h-8 ${isUncertain(ing.unit) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
                      />
                      <Input
                        placeholder="Zutat"
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, "name", e.target.value)}
                        className={`flex-1 text-xs h-8 ${isUncertain(ing.name) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
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
                    <Plus className="w-3 h-3 mr-1" /> Zutat hinzufugen
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
                className={`resize-none min-h-[100px] text-sm ${isUncertain(editableRecipe.instructions) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}
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
                placeholder="Neuen Tag eingeben und Enter drucken"
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Quelle (optional)
              </label>
              <Input
                placeholder="z.B. TikTok @kochname, Instagram @foodblogger"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleRetry}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nochmal versuchen
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveRecipe}
                disabled={createRecipeMutation.isPending || !editableRecipe.name || editableRecipe.name === "?"}
              >
                {createRecipeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
