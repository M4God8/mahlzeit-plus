import { useState } from "react";
import {
  ShoppingBag,
  Sparkles,
  Plus,
  Check,
  Trash2,
  Archive,
  ChevronDown,
  ChevronRight,
  Leaf,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useListShoppingLists,
  useGetShoppingList,
  useGenerateShoppingList,
  useToggleShoppingListItem,
  useAddShoppingListItem,
  useDeleteShoppingListItem,
  useArchiveShoppingList,
  useDeleteShoppingList,
  useGetShoppingListCost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListShoppingListsQueryKey, getGetShoppingListQueryKey } from "@workspace/api-client-react";
import type { ShoppingListSummary } from "@workspace/api-client-react";

const CATEGORIES = [
  "Gemüse & Obst",
  "Protein",
  "Getreide & Brot",
  "Milchprodukte",
  "Gewürze & Öle",
  "Sonstiges",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Gemüse & Obst": "🥦",
  "Protein": "🥩",
  "Getreide & Brot": "🌾",
  "Milchprodukte": "🧀",
  "Gewürze & Öle": "🧄",
  "Sonstiges": "📦",
};

export default function Shopping() {
  const queryClient = useQueryClient();
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Sonstiges");

  const { data: listSummaries = [], isLoading: listsLoading } = useListShoppingLists();
  const { data: activeList } = useGetShoppingList(activeListId ?? 0);
  const { data: listCost } = useGetShoppingListCost(activeListId ?? 0, {
    query: { enabled: activeListId !== null, queryKey: ["/api/costs/shopping-list", String(activeListId ?? 0)] }
  });

  const generateMutation = useGenerateShoppingList({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListShoppingListsQueryKey() });
        setActiveListId(data.id);
      },
    },
  });

  const toggleMutation = useToggleShoppingListItem({
    mutation: {
      onSuccess: (_, { id, itemId }) => {
        queryClient.invalidateQueries({ queryKey: getGetShoppingListQueryKey(id) });
      },
    },
  });

  const addItemMutation = useAddShoppingListItem({
    mutation: {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: getGetShoppingListQueryKey(id) });
        setNewItemName("");
        setNewItemAmount("");
        setNewItemUnit("");
        setNewItemCategory("Sonstiges");
        setShowAddForm(false);
      },
    },
  });

  const deleteItemMutation = useDeleteShoppingListItem({
    mutation: {
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: getGetShoppingListQueryKey(id) });
      },
    },
  });

  const archiveMutation = useArchiveShoppingList({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShoppingListsQueryKey() });
        setActiveListId(null);
      },
    },
  });

  const deleteMutation = useDeleteShoppingList({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListShoppingListsQueryKey() });
        setActiveListId(null);
      },
    },
  });

  const activeSummaries = listSummaries.filter((l) => !l.isArchived);
  const archivedSummaries = listSummaries.filter((l) => l.isArchived);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleAddItem = () => {
    if (!activeListId || !newItemName.trim()) return;
    addItemMutation.mutate({
      id: activeListId,
      data: {
        name: newItemName.trim(),
        amount: newItemAmount.trim() || null,
        unit: newItemUnit.trim() || null,
        category: newItemCategory,
      },
    });
  };

  if (listsLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] pb-24 bg-background">
        <header className="px-6 pt-10 pb-6">
          <h2 className="font-display text-4xl font-bold text-primary">Einkauf</h2>
        </header>
        <main className="flex-1 px-4 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (activeListId !== null && activeList) {
    const groupedItems: Record<string, typeof activeList.items> = {};
    for (const cat of CATEGORIES) groupedItems[cat] = [];
    for (const item of activeList.items) {
      const cat = CATEGORIES.includes(item.category) ? item.category : "Sonstiges";
      groupedItems[cat]!.push(item);
    }

    const totalItems = activeList.items.length;
    const checkedItems = activeList.items.filter((i) => i.isChecked).length;
    const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

    return (
      <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-300 bg-background text-foreground">
        <header className="px-6 pt-10 pb-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/40">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => setActiveListId(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-display text-2xl font-bold text-primary truncate flex-1">
              {activeList.title}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            {activeList.weekFrom} – {activeList.weekTo}
          </p>
          {listCost && (
            <div className="mt-2 ml-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <p className="text-sm font-semibold text-emerald-700">
                Diese Woche: ca. {listCost.min.toFixed(0)}€ – {listCost.max.toFixed(0)}€ (∅ {listCost.avg.toFixed(0)}€)
              </p>
            </div>
          )}
          <div className="mt-3 ml-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{checkedItems} von {totalItems} erledigt</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 space-y-3">
          {CATEGORIES.map((cat) => {
            const items = groupedItems[cat] ?? [];
            if (items.length === 0) return null;
            const isCollapsed = collapsedCategories.has(cat);
            const catChecked = items.filter((i) => i.isChecked).length;

            return (
              <div key={cat} className="rounded-2xl overflow-hidden border border-border/30 bg-card">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors"
                >
                  <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                  <span className="font-semibold text-sm flex-1 text-left">{cat}</span>
                  <span className="text-xs text-muted-foreground">{catChecked}/{items.length}</span>
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {!isCollapsed && (
                  <div className="border-t border-border/20">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3.5 border-b border-border/10 last:border-b-0"
                      >
                        <button
                          onClick={() => toggleMutation.mutate({ id: activeListId, itemId: item.id })}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            item.isChecked
                              ? "bg-primary border-primary"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {item.isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>
                              {item.name}
                            </span>
                            {item.bioRecommended && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">
                                <Leaf className="w-2.5 h-2.5" />
                                Bio
                              </span>
                            )}
                          </div>
                          {(item.amount || item.unit) && (
                            <p className={`text-xs mt-0.5 ${item.isChecked ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                              {[item.amount, item.unit].filter(Boolean).join(" ")}
                            </p>
                          )}
                        </div>

                        {item.isManual && (
                          <button
                            onClick={() => deleteItemMutation.mutate({ id: activeListId, itemId: item.id })}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl border border-dashed border-border/50 overflow-hidden">
            {showAddForm ? (
              <div className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Manuell hinzufügen</p>
                <Input
                  placeholder="Produktname *"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="rounded-xl"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Menge"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(e.target.value)}
                    className="rounded-xl w-24"
                  />
                  <Input
                    placeholder="Einheit"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="rounded-xl w-24"
                  />
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="flex-1 text-sm border border-input rounded-xl px-3 bg-background"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddItem}
                    disabled={!newItemName.trim() || addItemMutation.isPending}
                    className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
                    size="sm"
                  >
                    Hinzufügen
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setShowAddForm(false); setNewItemName(""); }}
                    className="rounded-xl"
                    size="sm"
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Manuell hinzufügen</span>
              </button>
            )}
          </div>
        </main>

        <div className="px-4 pt-4 pb-6 border-t border-border/30 flex gap-2 bg-background">
          <Button
            variant="outline"
            onClick={() => archiveMutation.mutate({ id: activeListId })}
            disabled={archiveMutation.isPending}
            className="flex-1 rounded-xl gap-2"
            size="sm"
          >
            <Archive className="w-4 h-4" />
            Archivieren
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Liste wirklich löschen?")) {
                deleteMutation.mutate({ id: activeListId });
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            size="sm"
          >
            <Trash2 className="w-4 h-4" />
            Löschen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500 bg-background text-foreground">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary">Einkauf</h2>
        <p className="text-muted-foreground mt-1">Deine intelligente Einkaufsliste</p>
      </header>

      <main className="flex-1 px-4 space-y-4">
        <div className="rounded-3xl bg-primary/5 border border-primary/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold mb-1">Auto-Generierung</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Erstelle automatisch eine vollständige Einkaufsliste aus deinem aktiven Wochenplan — mit Smart Merge und Bio-Empfehlungen.
              </p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="rounded-xl bg-primary hover:bg-primary/90 gap-2 w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Wird generiert…
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Einkaufsliste generieren
                  </>
                )}
              </Button>
              {generateMutation.isError && (
                <p className="text-xs text-destructive mt-2">
                  Fehler: Kein aktiver Plan gefunden. Bitte aktiviere zuerst einen Mahlzeitenplan.
                </p>
              )}
            </div>
          </div>
        </div>

        {activeSummaries.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Aktuelle Listen</h3>
            <div className="space-y-2">
              {activeSummaries.map((list) => (
                <ShoppingListCard
                  key={list.id}
                  list={list}
                  onOpen={() => setActiveListId(list.id)}
                />
              ))}
            </div>
          </div>
        )}

        {archivedSummaries.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchive((p) => !p)}
              className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2 px-1 w-full"
            >
              <Archive className="w-3.5 h-3.5" />
              Archiv ({archivedSummaries.length})
              {showArchive ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </button>
            {showArchive && (
              <div className="space-y-2">
                {archivedSummaries.map((list) => (
                  <ShoppingListCard
                    key={list.id}
                    list={list}
                    onOpen={() => setActiveListId(list.id)}
                    archived
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {listSummaries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Einkaufslisten erstellt.</p>
            <p className="text-xs mt-1">Generiere deine erste Liste aus dem aktiven Plan.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ShoppingListCard({
  list,
  onOpen,
  archived = false,
}: {
  list: ShoppingListSummary;
  onOpen: () => void;
  archived?: boolean;
}) {
  const progress = list.itemCount > 0 ? (list.checkedCount / list.itemCount) * 100 : 0;

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl border border-border/40 bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${archived ? "bg-muted" : "bg-primary/10"}`}>
          {archived ? <Archive className="w-5 h-5 text-muted-foreground" /> : <ShoppingBag className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{list.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {list.weekFrom} – {list.weekTo}
          </p>
          {list.itemCount > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{list.checkedCount}/{list.itemCount} Produkte</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
