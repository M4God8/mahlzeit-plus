import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateRecipe } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Loader2, Save } from "lucide-react";
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

export default function NewRecipe() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createRecipe = useCreateRecipe();

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
    }
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const tagsArray = values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    
    createRecipe.mutate({
      data: {
        ...values,
        tags: tagsArray,
        ingredients: [] // Phase 2: Ingredients builder
      }
    }, {
      onSuccess: (recipe) => {
        toast({ title: "Gespeichert", description: "Rezept wurde erfolgreich angelegt." });
        setLocation(`/rezepte/${recipe.id}`);
      },
      onError: () => {
        toast({ title: "Fehler", description: "Konnte Rezept nicht speichern.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 bg-background text-foreground animate-in fade-in">
      <header className="px-4 py-4 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/rezepte">
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 -ml-2" data-testid="btn-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h2 className="font-display text-xl font-bold">Neues Rezept</h2>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={createRecipe.isPending}
          className="rounded-full shadow-sm"
          size="sm"
          data-testid="btn-save-recipe"
        >
          {createRecipe.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Textarea 
                      placeholder="1. Zwiebeln hacken..." 
                      className="min-h-[200px] rounded-xl" 
                      {...field} 
                    />
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
                    <div className="text-sm text-muted-foreground">
                      Andere Nutzer können dieses Rezept sehen
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
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
