import { Link, useRoute, useLocation } from "wouter";
import { useGetRecipe, useDeleteRecipe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, Users, Flame, ChefHat, Trash2, Edit2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function RecipeDetail() {
  const [, params] = useRoute("/rezepte/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: recipe, isLoading } = useGetRecipe(id, {
    query: { enabled: !!id, queryKey: ["/api/recipes", id.toString()] }
  });

  const deleteRecipe = useDeleteRecipe();

  const handleDelete = () => {
    deleteRecipe.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Gelöscht", description: "Rezept wurde gelöscht." });
        setLocation("/rezepte");
      },
      onError: () => {
        toast({ title: "Fehler", description: "Konnte Rezept nicht löschen.", variant: "destructive" });
      }
    });
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
        <p className="text-muted-foreground mb-6">Dieses Rezept existiert nicht oder wurde gelöscht.</p>
        <Link href="/rezepte">
          <Button className="rounded-full">Zurück zur Übersicht</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 bg-background text-foreground">
      <div className="h-64 sm:h-80 w-full bg-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-0"></div>
        <header className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10">
          <Link href="/rezepte">
            <Button variant="secondary" size="icon" className="rounded-full bg-background/50 backdrop-blur-md hover:bg-background/80" data-testid="btn-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" className="rounded-full bg-background/50 backdrop-blur-md hover:bg-background/80" data-testid="btn-edit">
              <Edit2 className="w-4 h-4" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="rounded-full bg-destructive/80 backdrop-blur-md hover:bg-destructive" data-testid="btn-delete">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Rezept löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Möchtest du "{recipe.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>
      </div>

      <main className="flex-1 px-6 -mt-16 relative z-10 max-w-3xl w-full mx-auto animate-in fade-in slide-in-from-bottom-8">
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {recipe.energyType && (
              <Badge className="bg-accent text-accent-foreground border-transparent px-3 py-1 rounded-md text-xs font-medium capitalize">
                {recipe.energyType}
              </Badge>
            )}
            {recipe.tags?.map(tag => (
              <Badge key={tag} variant="outline" className="px-3 py-1 rounded-md text-xs bg-card">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight mb-4">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-lg text-muted-foreground leading-relaxed">{recipe.description}</p>
          )}
        </div>

        <div className="flex gap-6 py-6 border-y border-border/50 mb-8 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Zeit</p>
              <p className="font-mono font-medium">{recipe.prepTime + recipe.cookTime} min</p>
            </div>
          </div>
          
          <div className="w-px h-10 bg-border/50 shrink-0"></div>
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Portionen</p>
              <p className="font-mono font-medium">{recipe.servings}</p>
            </div>
          </div>

          <div className="w-px h-10 bg-border/50 shrink-0"></div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Typ</p>
              <p className="font-medium capitalize">{recipe.energyType}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="font-display text-2xl font-bold mb-4">Zutaten</h3>
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <ul className="space-y-3">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <span className="font-medium">{ing.customName || ing.ingredientName || "Zutat"}</span>
                    <span className="font-mono text-primary font-semibold">{ing.amount} {ing.unit}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 rounded-xl bg-muted/30 text-muted-foreground text-sm italic">
                Keine Zutatenliste hinterlegt.
              </div>
            )}
          </section>

          <section>
            <h3 className="font-display text-2xl font-bold mb-4">Zubereitung</h3>
            <div className="prose prose-stone dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
