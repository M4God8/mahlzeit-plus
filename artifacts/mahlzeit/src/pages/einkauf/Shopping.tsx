import { ShoppingBag, Sparkles } from "lucide-react";

export default function Shopping() {
  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500 bg-background text-foreground">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary">Einkauf</h2>
        <p className="text-muted-foreground mt-1">Deine intelligente Einkaufsliste</p>
      </header>

      <main className="flex-1 px-4 flex flex-col items-center justify-center">
        <div className="text-center max-w-sm mx-auto p-8 rounded-3xl bg-accent/5 border border-accent/20">
          <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-border">
            <ShoppingBag className="w-10 h-10 text-accent" />
          </div>
          <h3 className="font-display text-2xl font-bold mb-3">Smarte Einkaufsliste</h3>
          <p className="text-muted-foreground mb-6">
            In Phase 3 wird hier automatisch deine Einkaufsliste basierend auf deinem Wochenplan generiert.
          </p>
          <div className="flex items-center justify-center gap-2 text-accent font-medium bg-accent/10 py-2 px-4 rounded-full w-max mx-auto">
            <Sparkles className="w-4 h-4" />
            <span>Kommt bald</span>
          </div>
        </div>
      </main>
    </div>
  );
}
