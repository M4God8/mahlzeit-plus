import { useListMealPlans } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Plus, Info } from "lucide-react";

export default function Plan() {
  const { data: plans, isLoading } = useListMealPlans();

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 flex justify-between items-end">
        <div>
          <h2 className="font-display text-4xl font-bold text-primary">Wochenplan</h2>
          <p className="text-muted-foreground mt-1">Deine Mahlzeiten im Überblick</p>
        </div>
        <Button size="icon" className="rounded-full shadow-sm bg-primary/10 text-primary hover:bg-primary/20 border-0" data-testid="btn-new-plan">
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 px-4 space-y-6">
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex gap-3 text-accent-foreground mb-6">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Plan-Builder kommt bald</p>
            <p className="opacity-90">In Phase 2 kannst du hier deine Mahlzeiten für die ganze Woche per Drag & Drop zusammenstellen und automatisch generieren lassen.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-4">
            {plans.map(plan => (
              <Card key={plan.id} className={`overflow-hidden border-border/50 hover-elevate transition-all ${plan.active ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`} data-testid={`card-plan-${plan.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-display text-xl">{plan.title}</CardTitle>
                    {plan.active && (
                      <span className="text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Aktiv</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{plan.cycleLengthDays} Tage Rhythmus</span>
                  </div>
                  {plan.repeatEnabled && (
                    <div className="text-xs text-muted-foreground mt-2 inline-block bg-muted px-2 py-1 rounded">
                      Wiederholt sich automatisch
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-muted/50 rounded-3xl border border-dashed border-border">
            <CalendarIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-display text-xl font-semibold mb-2">Noch keine Pläne</h3>
            <p className="text-muted-foreground">
              Erstelle deinen ersten Mahlzeitenplan, um entspannter durch die Woche zu kommen.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
