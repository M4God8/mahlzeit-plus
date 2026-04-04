import { useState, useCallback, useRef } from "react";
import { useZxing } from "react-zxing";
import { useScannerLookup, useGetScanHistory } from "@workspace/api-client-react";
import type { ScannedProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ScanBarcode, History, ChevronLeft, X, AlertCircle, CheckCircle2, XCircle, Info, Sparkles, ShoppingBasket, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import ScannerRecipeModal from "./ScannerRecipeModal";

type Tab = "scan" | "history";

function scoreLabel(total: number): string {
  if (total >= 80) return "Sehr empfehlenswert";
  if (total >= 60) return "Gut — gelegentlich";
  if (total >= 40) return "Mit Bedacht";
  return "Lieber vermeiden";
}

function scoreEmoji(total: number): string {
  if (total >= 80) return "🟢";
  if (total >= 60) return "🟡";
  if (total >= 40) return "🟠";
  return "🔴";
}

function scoreColorClass(total: number): string {
  if (total >= 80) return "bg-green-500";
  if (total >= 60) return "bg-yellow-400";
  if (total >= 40) return "bg-orange-400";
  return "bg-red-500";
}

function scoreTextColorClass(total: number): string {
  if (total >= 80) return "text-green-700";
  if (total >= 60) return "text-yellow-700";
  if (total >= 40) return "text-orange-600";
  return "text-red-600";
}

const FOOD_SUB_SCORES = [
  { key: "scoreNaturalness", label: "Zutatenklarheit" },
  { key: "scoreNutrientBalance", label: "Nährwert-Balance" },
  { key: "scoreProfileFit", label: "Profil-Fit" },
  { key: "scoreQualityBonus", label: "Qualitätsbonus" },
] as const;

const COSMETIC_SUB_SCORES = [
  { key: "scoreNaturalness", label: "Natürlichkeit" },
  { key: "scoreNutrientBalance", label: "Inhaltsstoff-Klarheit" },
  { key: "scoreProfileFit", label: "Profil-Fit" },
  { key: "scoreQualityBonus", label: "Qualitätsbonus" },
] as const;

function getSubScores(productType: string) {
  return productType === "cosmetic" ? COSMETIC_SUB_SCORES : FOOD_SUB_SCORES;
}

function ScoreBar({ value, max = 25 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : pct >= 40 ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ProductResult({ product, onReset, onCreateRecipe }: { product: ScannedProduct; onReset: () => void; onCreateRecipe?: () => void }) {
  const fitsProfile = product.profileFitExclusions.length === 0;
  const isCosmetic = product.productType === "cosmetic";
  const subScores = getSubScores(product.productType);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <button onClick={onReset} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-display font-bold text-lg flex-1 line-clamp-1">
          {product.productName || product.brand || "Unbekanntes Produkt"}
        </h2>
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-semibold px-2 py-0.5 shrink-0",
            isCosmetic
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}
        >
          {isCosmetic ? (
            <><Sparkles className="w-3 h-3 mr-1 inline" />Kosmetik</>
          ) : (
            <><ShoppingBasket className="w-3 h-3 mr-1 inline" />Lebensmittel</>
          )}
        </Badge>
      </div>

      {product.imageUrl && (
        <div className="w-full aspect-video rounded-2xl overflow-hidden bg-muted">
          <img src={product.imageUrl} alt={product.productName ?? ""} className="w-full h-full object-contain" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          {product.brand && <p className="text-sm text-muted-foreground">{product.brand}</p>}
          <p className="text-xs font-mono text-muted-foreground/60">{product.barcode}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-base font-bold px-3 py-1 border-none",
            fitsProfile ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          )}
        >
          {fitsProfile ? (
            <><CheckCircle2 className="w-4 h-4 mr-1.5 inline" />Passt zu deinem Profil</>
          ) : (
            <><XCircle className="w-4 h-4 mr-1.5 inline" />Passt nicht (Ausschluss: {product.profileFitExclusions[0]})</>
          )}
        </Badge>
      </div>

      {!fitsProfile && (
        <div className="flex flex-wrap gap-1.5">
          {product.profileFitExclusions.map((ex: string) => (
            <Badge key={ex} variant="destructive" className="text-xs">
              {ex}
            </Badge>
          ))}
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-lg">Gesamt-Score</span>
            <span className={cn("text-3xl font-bold", scoreTextColorClass(product.totalScore))}>
              {scoreEmoji(product.totalScore)} {product.totalScore}/100
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", scoreColorClass(product.totalScore))}
              style={{ width: `${product.totalScore}%` }}
            />
          </div>
          <p className={cn("text-sm font-semibold", scoreTextColorClass(product.totalScore))}>
            {scoreLabel(product.totalScore)}
          </p>

          <div className="space-y-3 pt-2 border-t border-border/50">
            {subScores.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">{product[key]}/25</span>
                </div>
                <ScoreBar value={product[key]} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {product.fluorideNote && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">{product.fluorideNote}</p>
        </div>
      )}

      {!isCosmetic && product.ingredients && onCreateRecipe && (
        <Button
          onClick={onCreateRecipe}
          variant="outline"
          className="w-full border-primary/30 text-primary hover:bg-primary/5"
        >
          <ChefHat className="w-4 h-4 mr-2" />
          Selbst machen — KI-Rezept erstellen
        </Button>
      )}

      {product.ingredients && (
        <details className="group">
          <summary className="text-sm text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
            {isCosmetic ? "INCI / Inhaltsstoffe anzeigen" : "Zutaten anzeigen"}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-xl">
            {product.ingredients}
          </p>
        </details>
      )}
    </div>
  );
}

function HistoryItem({ product, onClick }: { product: ScannedProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-white shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ScanBarcode className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{product.productName || product.brand || product.barcode}</p>
          {product.productType === "cosmetic" && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200 shrink-0">
              Kosmetik
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{product.brand}</p>
      </div>
      <span className={cn("text-sm font-bold shrink-0", scoreTextColorClass(product.totalScore))}>
        {scoreEmoji(product.totalScore)} {product.totalScore}
      </span>
    </button>
  );
}

function ActiveScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { ref } = useZxing({
    onDecodeResult(result) {
      onDetected(result.getText());
    },
    onError(err) {
      console.error("[Scanner] ZXing error:", err);
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setCameraError("Kamera-Zugriff wurde verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.");
        } else if (err.name === "NotFoundError") {
          setCameraError("Keine Kamera gefunden. Bitte nutze die manuelle Eingabe unten.");
        } else if (err.name === "NotReadableError") {
          setCameraError("Kamera wird von einer anderen App verwendet. Bitte schließe andere Kamera-Apps.");
        } else {
          setCameraError(`Kamera-Fehler: ${err.message}`);
        }
      }
    },
    constraints: {
      video: { facingMode: "environment" },
      audio: false,
    },
    timeBetweenDecodingAttempts: 500,
  });

  if (cameraError) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-muted/50 flex flex-col items-center justify-center p-6 text-center border border-border/50">
        <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{cameraError}</p>
        <Button variant="outline" size="sm" onClick={() => setCameraError(null)}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
      <video ref={ref} className="w-full h-full object-cover" playsInline muted autoPlay />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 border-2 border-white/70 rounded-xl">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />
        </div>
      </div>
      <p className="absolute bottom-4 inset-x-0 text-center text-white/80 text-sm">
        Barcode in den Rahmen halten
      </p>
    </div>
  );
}

function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [cameraStarted, setCameraStarted] = useState(false);

  if (!cameraStarted) {
    return (
      <div className="w-full aspect-square rounded-2xl bg-muted/30 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-border">
        <ScanBarcode className="w-16 h-16 text-primary/40 mb-4" />
        <p className="text-sm text-muted-foreground mb-4">
          Tippe um die Kamera zu aktivieren und einen Barcode zu scannen.
        </p>
        <Button onClick={() => setCameraStarted(true)} className="rounded-full px-6">
          <ScanBarcode className="w-4 h-4 mr-2" />
          Kamera starten
        </Button>
      </div>
    );
  }

  return <ActiveScanner onDetected={onDetected} />;
}

export default function Scanner() {
  const [tab, setTab] = useState<Tab>("scan");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ScannedProduct | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeModalProduct, setRecipeModalProduct] = useState<ScannedProduct | null>(null);
  const [, setLocation] = useLocation();

  const {
    data: product,
    isLoading: isLookingUp,
    error: lookupError,
  } = useScannerLookup(barcode ?? "", {
    query: { enabled: !!barcode, queryKey: ["/api/scanner/lookup", barcode ?? ""] },
  });

  const { data: history, isLoading: historyLoading } = useGetScanHistory({
    query: { enabled: tab === "history", queryKey: ["/api/scanner/history"] },
  });

  const handleDetected = useCallback(
    (code: string) => {
      if (isPaused) return;
      if (/^\d{8,14}$/.test(code)) {
        setBarcode(code);
        setIsPaused(true);
      }
    },
    [isPaused]
  );

  const reset = () => {
    setBarcode(null);
    setIsPaused(false);
  };

  const handleManualSubmit = () => {
    const cleaned = manualBarcode.trim();
    if (/^\d{8,14}$/.test(cleaned)) {
      setBarcode(cleaned);
      setIsPaused(true);
      setManualBarcode("");
    }
  };

  const openRecipeModal = useCallback((p: ScannedProduct) => {
    setRecipeModalProduct(p);
    setRecipeModalOpen(true);
  }, []);

  if (selectedHistoryItem) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="px-4 pt-12 pb-6">
          <ProductResult
            product={selectedHistoryItem}
            onReset={() => setSelectedHistoryItem(null)}
            onCreateRecipe={() => openRecipeModal(selectedHistoryItem)}
          />
        </div>
        {recipeModalProduct && (
          <ScannerRecipeModal
            open={recipeModalOpen}
            onOpenChange={setRecipeModalOpen}
            productName={recipeModalProduct.productName ?? recipeModalProduct.brand ?? "Produkt"}
            barcode={recipeModalProduct.barcode}
            ingredients={recipeModalProduct.ingredients ?? ""}
            onRecipeSaved={() => {}}
            onGoToShoppingList={() => setLocation("/einkauf")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="px-4 pt-12 pb-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">Scanner</h1>
          <p className="text-muted-foreground text-sm mt-1">Produkt scannen und Score prüfen</p>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-xl">
          {(["scan", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "scan" ? <ScanBarcode className="w-4 h-4" /> : <History className="w-4 h-4" />}
              {t === "scan" ? "Scannen" : "Verlauf"}
            </button>
          ))}
        </div>

        {tab === "scan" && (
          <div className="space-y-4">
            {product && isPaused ? (
              <ProductResult product={product} onReset={reset} onCreateRecipe={() => openRecipeModal(product)} />
            ) : isLookingUp ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Produkt wird abgerufen…</p>
              </div>
            ) : lookupError ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-4 bg-destructive/10 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-destructive">
                      {(lookupError as { status?: number })?.status === 502
                        ? "Externer Dienst nicht erreichbar — bitte erneut versuchen."
                        : (lookupError as { status?: number })?.status === 404
                          ? "Produkt nicht gefunden — manuelle Eingabe möglich"
                          : "Fehler beim Abrufen des Produkts. Bitte erneut versuchen."}
                    </p>
                    {(lookupError as { status?: number })?.status === 404 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          reset();
                          setTimeout(() => {
                            manualInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                            manualInputRef.current?.focus();
                          }, 100);
                        }}
                      >
                        Manuell eingeben
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={reset}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <BarcodeScanner onDetected={handleDetected} />
              </div>
            ) : (
              <div className="space-y-4">
                <BarcodeScanner onDetected={handleDetected} />
                <div className="flex gap-2">
                  <input
                    ref={manualInputRef}
                    type="number"
                    inputMode="numeric"
                    placeholder="Barcode manuell eingeben"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                    className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button size="sm" onClick={handleManualSubmit} disabled={!/^\d{8,14}$/.test(manualBarcode.trim())}>
                    Suchen
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-2">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !history?.length ? (
              <div className="text-center py-16 space-y-2">
                <ScanBarcode className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">Noch keine Scans. Scanne dein erstes Produkt!</p>
              </div>
            ) : (
              history.map((item: ScannedProduct) => (
                <HistoryItem
                  key={item.id}
                  product={item}
                  onClick={() => setSelectedHistoryItem(item)}
                />
              ))
            )}
          </div>
        )}
      </div>
      {recipeModalProduct && (
        <ScannerRecipeModal
          open={recipeModalOpen}
          onOpenChange={setRecipeModalOpen}
          productName={recipeModalProduct.productName ?? recipeModalProduct.brand ?? "Produkt"}
          barcode={recipeModalProduct.barcode}
          ingredients={recipeModalProduct.ingredients ?? ""}
          onRecipeSaved={() => {}}
          onGoToShoppingList={() => setLocation("/einkauf")}
        />
      )}
    </div>
  );
}
