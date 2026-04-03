import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useListNutritionProfiles, useCreateOrUpdateUserSettings } from "@workspace/api-client-react";
import { ArrowRight, Check, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [householdSize, setHouseholdSize] = useState(2);
  const [budgetLevel, setBudgetLevel] = useState("medium");
  const [cookTimeLimit, setCookTimeLimit] = useState(30);

  const { data: profiles, isLoading: isLoadingProfiles } = useListNutritionProfiles();
  const updateSettings = useCreateOrUpdateUserSettings();

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const toggleProfile = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        toast({ title: "Maximal 3 Profile", description: "Du kannst höchstens 3 Ernährungsprofile auswählen.", variant: "destructive" });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleComplete = () => {
    if (selectedIds.length === 0) {
      toast({ title: "Fehler", description: "Bitte wähle mindestens ein Profil aus.", variant: "destructive" });
      return;
    }
    
    updateSettings.mutate({
      data: {
        activeProfileIds: selectedIds,
        householdSize,
        budgetLevel,
        cookTimeLimit,
        bioPreferred: false
      }
    }, {
      onSuccess: async () => {
        queryClient.setQueryData(["user-settings-check"], true);
        let starterPlanCreated = false;
        try {
          const res = await fetch("/api/meal-plans/starter", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          starterPlanCreated = res.ok;
        } catch {
          starterPlanCreated = false;
        }
        toast({
          title: "Willkommen!",
          description: starterPlanCreated
            ? "Dein Profil wurde eingerichtet. Dein erster Plan wartet auf dich."
            : "Dein Profil wurde gespeichert. Erstelle deinen ersten Mahlzeitenplan unter 'Plan'.",
        });
        setLocation("/heute");
      },
      onError: () => {
        toast({ title: "Fehler", description: "Profil konnte nicht gespeichert werden.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pt-12 pb-safe px-4">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            {step > 1 && (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleBack} data-testid="button-back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1 flex justify-center">
              <span className="font-display font-bold text-lg text-primary">Mahlzeit+</span>
            </div>
            {step > 1 && <div className="h-8 w-8" />}
          </div>
          
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-primary/20"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1">
          {step === 1 && (
            <div className="flex flex-col items-center text-center justify-center h-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground">Willkommen bei Mahlzeit+</h1>
              <p className="text-muted-foreground text-lg">
                Wir richten kurz dein Profil ein, damit wir dir passende Mahlzeiten und Einkaufslisten vorschlagen können.
              </p>
              <p className="text-muted-foreground">
                Dauert nur 1 Minute.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="font-display text-2xl font-bold mb-2">Wie isst du am liebsten?</h2>
                <p className="text-muted-foreground">Wähle 1–3 Ernährungsweisen, die zu dir passen.</p>
              </div>

              {isLoadingProfiles ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : (
                <div className="grid gap-3">
                  {profiles?.map(profile => {
                    const isSelected = selectedIds.includes(profile.id);
                    return (
                      <Card 
                        key={profile.id} 
                        className={`cursor-pointer transition-all hover-elevate ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
                        onClick={() => toggleProfile(profile.id)}
                        data-testid={`card-profile-${profile.id}`}
                      >
                        <CardContent className="p-4 flex items-start gap-4">
                          <div className="mt-1">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{profile.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
                            <span className="inline-block mt-2 rounded-full text-xs font-semibold" style={{ backgroundColor: '#C9A84C', color: '#FFFFFF', padding: '2px 10px', fontSize: '12px' }}>
                              {profile.energyLabel}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              {selectedIds.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {selectedIds.length}/3 Profile ausgewählt
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h2 className="font-display text-2xl font-bold mb-2">Dein Haushalt</h2>
                <p className="text-muted-foreground">Damit wir Portionsgrößen und Mengen richtig berechnen.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base">Personen im Haushalt: <span className="font-mono text-primary font-bold">{householdSize}</span></Label>
                  <Slider 
                    value={[householdSize]} 
                    min={1} max={6} step={1} 
                    onValueChange={v => setHouseholdSize(v[0])}
                    data-testid="slider-household"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6+</span>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <Label className="text-base">Budget-Präferenz</Label>
                  <RadioGroup value={budgetLevel} onValueChange={setBudgetLevel} className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((level, i) => (
                      <div key={level} className="relative">
                        <RadioGroupItem value={level} id={`budget-${level}`} className="peer sr-only" data-testid={`radio-budget-${level}`} />
                        <Label 
                          htmlFor={`budget-${level}`} 
                          className="flex flex-col items-center justify-center p-3 border rounded-md cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted"
                        >
                          <span className="text-lg">{'€'.repeat(i + 1)}</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            {level === 'low' ? 'Günstig' : level === 'medium' ? 'Mittel' : 'Premium'}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-3 pt-4">
                  <Label className="text-base">Maximale Kochzeit (Werktags)</Label>
                  <RadioGroup value={cookTimeLimit.toString()} onValueChange={v => setCookTimeLimit(parseInt(v))} className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map((time) => (
                      <div key={time} className="relative">
                        <RadioGroupItem value={time.toString()} id={`time-${time}`} className="peer sr-only" data-testid={`radio-time-${time}`} />
                        <Label 
                          htmlFor={`time-${time}`} 
                          className="flex flex-col items-center justify-center p-3 border rounded-md cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted font-mono"
                        >
                          <span className="text-lg">{time}</span>
                          <span className="text-xs text-muted-foreground mt-1 font-sans">Minuten</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t">
          {step < 3 ? (
            <Button 
              className="w-full h-12 text-base rounded-full" 
              onClick={handleNext}
              disabled={step === 2 && selectedIds.length === 0}
              data-testid="button-next"
            >
              Weiter <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              className="w-full h-12 text-base rounded-full" 
              onClick={handleComplete}
              disabled={updateSettings.isPending}
              data-testid="button-complete"
            >
              {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Profil speichern
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
