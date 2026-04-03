import { useState } from "react";
import { Link } from "wouter";
import { useListRecipes } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Clock, Plus, Book, Leaf } from "lucide-react";

export default function RecipeList() {
  const [search, setSearch] = useState("");
  const [energyType, setEnergyType] = useState<string>("");

  const { data: recipes, isLoading } = useListRecipes({ 
    search: search || undefined,
    energyType: energyType || undefined
  });

  const energyTypes = ["leicht", "sättigend", "schnell", "warm"];

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500 bg-background text-foreground">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border/50">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="font-display text-4xl font-bold text-primary">Rezepte</h2>
            <p className="text-muted-foreground mt-1">Deine Sammlung</p>
          </div>
          <Link href="/rezepte/neu" data-testid="link-new-recipe">
            <Button size="icon" className="rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-5 h-5" />
            </Button>
          </Link>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Rezepte durchsuchen..." 
            className="pl-10 h-12 rounded-full bg-muted/50 border-border/50 focus-visible:ring-primary"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-recipes"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          <Badge 
            variant={energyType === "" ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5"
            onClick={() => setEnergyType("")}
            data-testid="badge-filter-all"
          >
            Alle
          </Badge>
          {energyTypes.map(type => (
            <Badge 
              key={type}
              variant={energyType === type ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 capitalize ${energyType === type ? "bg-accent text-accent-foreground hover:bg-accent/90 border-transparent" : "border-border/50"}`}
              onClick={() => setEnergyType(type)}
              data-testid={`badge-filter-${type}`}
            >
              {type}
            </Badge>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : recipes && recipes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {recipes.map(recipe => (
              <Link key={recipe.id} href={`/rezepte/${recipe.id}`} data-testid={`link-recipe-${recipe.id}`}>
                <Card className="overflow-hidden border-border/50 shadow-sm hover-elevate transition-all cursor-pointer h-full group">
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-display text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">{recipe.title}</h3>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4 mb-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary/70" />
                          <span className="font-mono">{recipe.prepTime + recipe.cookTime} min</span>
                        </div>
                        {recipe.energyType && (
                          <div className="flex items-center gap-1.5">
                            <Leaf className="w-4 h-4 text-accent" />
                            <span className="capitalize">{recipe.energyType}</span>
                          </div>
                        )}
                      </div>

                      {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-auto">
                          {recipe.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                          {recipe.tags.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 bg-muted rounded-md text-muted-foreground">
                              +{recipe.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-muted/30 rounded-3xl border border-dashed border-border/60">
            <Book className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Keine Rezepte gefunden</h3>
            <p className="text-muted-foreground mb-6">
              {search || energyType ? "Versuche einen anderen Suchbegriff." : "Füge dein erstes Rezept hinzu."}
            </p>
            {!(search || energyType) && (
              <Link href="/rezepte/neu">
                <Button className="rounded-full">Rezept hinzufügen</Button>
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
