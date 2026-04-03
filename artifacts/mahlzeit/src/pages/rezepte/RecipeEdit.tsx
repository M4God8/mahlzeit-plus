import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetRecipe, useUpdateRecipe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Loader2, Save, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein"),
  description: z.string().optional(),
  prepTime: z.coerce.number().min(0),
  cookTime: z.coerce.number().min(0),
  servings: z.coerce.number().min(1),
  instructions: z.string().min(10, "Die Anleitung ist zu kurz"),
  energyType: z.string().min(1, "Bitte wähle einen Energie-Typ"),
  tags: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export default function RecipeEdit() {
  const [, params] = useRoute("/rezepte/:id/bearbeiten");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recipe, isLoading } = useGetRecipe(id, {
    query: { enabled: !!id, queryKey: ["/api/recipes", id.toString()] },
  });

  const updateRecipe = useUpdateRecipe();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      prepTime: 10,
      cookTime: 20,
      servings: 2,
      instructions: "",
      energyType: "sättigend",
      tags: "",
      isPublic: false,
    },
  });

  useEffect(() => {
    if (recipe) {
      form.reset({
        title: recipe.title,
        description: recipe.description ?? "",
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        instructions: recipe.instructions,
        energyType: recipe.energyType,
        tags: recipe.tags?.join(", ") ?? "",
        isPublic: recipe.isPublic,
      });
    }
  }, [recipe, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const tagsArray = values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    updateRecipe.mutate(
      { id, data: { ...values, tags: tagsArray } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/recipes", id.toString()] });
          queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
          toast({ title: "Gespeichert", description: "Rezept wurde aktualisiert." });
          setLocation(`/rezepte/${id}`);
        },
        onError: () => {
          toast({ title: "Fehler", description: "Konnte Rezept nicht speichern.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center text-center p-6 bg-background text-foreground">
        <ChefHat className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Rezept nicht gefunden</h2>
        <Button className="rounded-full mt-4" onClick={() => setLocation("/rezepte")}>Zurück</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 bg-background text-foreground animate-in fade-in">
      <header className="px-4 py-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 -ml-2" onClick={() => setLocation(`/rezepte/${id}`)} data-testid="btn-back">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h2 className="font-display text-xl font-bold">Rezept bearbeiten</h2>
        </div>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={updateRecipe.isPending}
          className="rounded-full shadow-sm"
          size="sm"
          data-testid="btn-save-recipe"
        >
          {updateRecipe.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Speichern
        </Button>
      </header>

      <main className="flex-1 px-6 py-6 max-w-2xl w-full mx-auto">
        <Form {...form}>
          <form className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Schnelle Tomaten-Pasta" className="h-12 rounded-xl text-lg font-display" {...field} data-testid="input-recipe-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kurzbeschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Ein perfektes Gericht für den Feierabend..." className="resize-none rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prepTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorbereitung (Min)</FormLabel>
                    <FormControl>
                      <Input type="number" className="rounded-xl font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cookTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kochzeit (Min)</FormLabel>
                    <FormControl>
                      <Input type="number" className="rounded-xl font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="servings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portionen</FormLabel>
                    <FormControl>
                      <Input type="number" className="rounded-xl font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="energyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Energie-Typ</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Wähle einen Typ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="leicht">Leicht</SelectItem>
                        <SelectItem value="sättigend">Sättigend</SelectItem>
                        <SelectItem value="schnell">Schnell</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zubereitung</FormLabel>
                  <FormControl>
                    <Textarea placeholder="1. Zwiebeln hacken..." className="min-h-[200px] rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (kommagetrennt)</FormLabel>
                  <FormControl>
                    <Input placeholder="vegan, pasta, sommer" className="rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/50 p-4 shadow-sm bg-card">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Öffentlich</FormLabel>
                    <div className="text-sm text-muted-foreground">Andere Nutzer können dieses Rezept sehen</div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </main>
    </div>
  );
}
