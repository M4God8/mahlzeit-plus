import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCoachingProducts,
  useCreateCoachingProduct,
  useUpdateCoachingProduct,
  useDeleteCoachingProduct,
  getListCoachingProductsQueryKey,
} from "@workspace/api-client-react";
import type { CoachingProduct } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, X, Check, Loader2, Package } from "lucide-react";

interface ProductFormData {
  name: string;
  description: string;
  url: string;
  tags: string;
  triggerKeywords: string;
  isActive: boolean;
}

const emptyForm: ProductFormData = {
  name: "",
  description: "",
  url: "",
  tags: "",
  triggerKeywords: "",
  isActive: true,
};

function productToForm(p: CoachingProduct): ProductFormData {
  return {
    name: p.name,
    description: p.description,
    url: p.url,
    tags: (p.tags ?? []).join(", "),
    triggerKeywords: (p.triggerKeywords ?? []).join(", "),
    isActive: p.isActive,
  };
}

function parseCommaSeparated(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useListCoachingProducts();
  const createMutation = useCreateCoachingProduct();
  const updateMutation = useUpdateCoachingProduct();
  const deleteMutation = useDeleteCoachingProduct();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ProductFormData>(emptyForm);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCoachingProductsQueryKey() });
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (product: CoachingProduct) => {
    setEditingId(product.id);
    setIsCreating(false);
    setForm(productToForm(product));
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      tags: parseCommaSeparated(form.tags),
      triggerKeywords: parseCommaSeparated(form.triggerKeywords),
      isActive: form.isActive,
    };

    if (isCreating) {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Produkt erstellt" });
            invalidate();
            handleCancel();
          },
          onError: () => {
            toast({ title: "Fehler beim Erstellen", variant: "destructive" });
          },
        }
      );
    } else if (editingId !== null) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Produkt aktualisiert" });
            invalidate();
            handleCancel();
          },
          onError: () => {
            toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Produkt wirklich löschen?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Produkt gelöscht" });
          invalidate();
        },
        onError: () => {
          toast({ title: "Fehler beim Löschen", variant: "destructive" });
        },
      }
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Coaching-Produkte
        </CardTitle>
        {!isCreating && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Neues Produkt
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isCreating && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-3">
            <h3 className="font-semibold text-sm">Neues Produkt erstellen</h3>
            <ProductForm form={form} setForm={setForm} />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Check className="w-4 h-4 mr-1" />
                Erstellen
              </Button>
            </div>
          </div>
        )}

        {(!products || products.length === 0) && !isCreating ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Produkte vorhanden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products ?? []).map((product) => (
                  <TableRow key={product.id}>
                    {editingId === product.id ? (
                      <TableCell colSpan={6}>
                        <div className="space-y-3 py-2">
                          <ProductForm form={form} setForm={setForm} />
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={handleCancel}>
                              <X className="w-4 h-4 mr-1" />
                              Abbrechen
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSaving}>
                              {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                              <Check className="w-4 h-4 mr-1" />
                              Speichern
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{product.name}</div>
                            {product.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.url ? (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate max-w-[150px] block"
                            >
                              {product.url}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(product.tags ?? []).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(product.triggerKeywords ?? []).map((kw) => (
                              <Badge key={kw} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.isActive ? "default" : "secondary"}>
                            {product.isActive ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(product.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductForm({
  form,
  setForm,
}: {
  form: ProductFormData;
  setForm: (f: ProductFormData) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Produktname"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Beschreibung</label>
        <Input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Kurze Beschreibung"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">URL</label>
        <Input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://fuergut.online/..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags (kommagetrennt)</label>
        <Input
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="ernährung, gesundheit, wasser"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Trigger-Keywords (kommagetrennt)</label>
        <Input
          value={form.triggerKeywords}
          onChange={(e) => setForm({ ...form, triggerKeywords: e.target.value })}
          placeholder="stress, wasser, gesund"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="w-4 h-4"
          id="product-active"
        />
        <label htmlFor="product-active" className="text-sm">Aktiv</label>
      </div>
    </div>
  );
}
