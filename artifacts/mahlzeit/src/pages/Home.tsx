import { Show } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground selection:bg-primary/20">
      <header className="w-full px-6 py-6 flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-tight text-primary">Mahlzeit+</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 pb-20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] pointer-events-none mix-blend-multiply"></div>
        <div className="max-w-md w-full space-y-8 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="space-y-4">
            <h1 className="font-display text-5xl sm:text-6xl font-bold leading-[1.1] text-foreground">
              Bewusst essen.<br />
              <span className="text-primary italic font-medium">Einfach planen.</span><br />
              Klar leben.
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed max-w-[85%] mx-auto">
              Dein täglicher Begleiter für entspannte Mahlzeiten. Kein Kalorienzählen, nur gute Planung.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/sign-up" className="w-full sm:w-auto" data-testid="link-signup">
              <Button size="lg" className="w-full text-base h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm hover-elevate">
                Jetzt starten
              </Button>
            </Link>
            <Link href="/sign-in" className="w-full sm:w-auto" data-testid="link-signin">
              <Button variant="outline" size="lg" className="w-full text-base h-12 rounded-full border-primary/20 text-foreground hover:bg-primary/5 hover-elevate">
                Anmelden
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
