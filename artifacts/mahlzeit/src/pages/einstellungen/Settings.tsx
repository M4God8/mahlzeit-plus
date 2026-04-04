import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import {
  useGetUserSettings,
  useListNutritionProfiles,
  useCreateOrUpdateUserSettings,
  useGetLearnProfile,
  useResetLearnProfile,
  useTriggerLearnAggregate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, LogOut, User as UserIcon, Brain, RotateCcw, RefreshCw, Clock, Utensils, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COMPLEXITY_LABEL: Record<string, string> = {
  simple: "Einfach & schnell",
  varied: "Abwechslungsreich & aufwendig",
  mixed: "Ausgewogen",
};

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading: isLoadingSettings } = useGetUserSettings();
  const { data: profiles, isLoading: isLoadingProfiles } = useListNutritionProfiles();
  const { data: learnProfile, isLoading: isLoadingLearn } = useGetLearnProfile({
    query: { queryKey: ["/api/learn/profile"], retry: false },
  });
  const updateSettings = useCreateOrUpdateUserSettings();
  const resetLearn = useResetLearnProfile();
  const aggregate = useTriggerLearnAggregate();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [householdSize, setHouseholdSize] = useState<number>(2);
  const [budgetLevel, setBudgetLevel] = useState<string>("medium");
  const [cookTimeLimit, setCookTimeLimit] = useState<number>(30);

  useEffect(() => {
    if (settings) {
      setSelectedIds(settings.activeProfileIds ?? []);
      setHouseholdSize(settings.householdSize);
      setBudgetLevel(settings.budgetLevel);
      setCookTimeLimit(settings.cookTimeLimit);
    }
  }, [settings]);

  const toggleProfile = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast({ title: "Mindestens 1 Profil", description: "Du brauchst mindestens ein aktives Ernährungsprofil.", variant: "destructive" });
          return prev;
        }
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        toast({ title: "Maximal 3 Profile", description: "Du kannst höchstens 3 Ernährungsprofile auswählen.", variant: "destructive" });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        activeProfileIds: selectedIds,
        householdSize,
        budgetLevel,
        cookTimeLimit,
        bioPreferred: settings?.bioPreferred || false
      }
    }, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Deine Einstellungen wurden aktualisiert." });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
      }
    });
  };

  const isSaving = updateSettings.isPending;

  const handleAggregate = () => {
    aggregate.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/learn/profile"] });
        toast({ title: "Essmuster aktualisiert", description: "Dein Lernprofil wurde neu berechnet." });
      },
      onError: () => toast({ title: "Fehler", description: "Aktualisierung fehlgeschlagen.", variant: "destructive" }),
    });
  };

  const handleResetLearn = () => {
    resetLearn.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/learn/profile"] });
        toast({ title: "Essmuster zurückgesetzt", description: "Dein Lernprofil wurde gelöscht." });
      },
      onError: () => toast({ title: "Fehler", description: "Zurücksetzen fehlgeschlagen.", variant: "destructive" }),
    });
  };

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500 bg-background text-foreground">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary">Einstellungen</h2>
        <p className="text-muted-foreground mt-1">Dein Profil und Präferenzen</p>
      </header>

      <main className="flex-1 px-4 space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-primary/20">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-xl font-bold truncate">{user?.fullName || "Benutzer"}</h3>
              <p className="text-muted-foreground text-sm truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </CardContent>
        </Card>

        {(isLoadingSettings || isLoadingProfiles) ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Präferenzen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Ernährungsprofile</Label>
                  <span className="text-sm text-muted-foreground">{selectedIds.length}/3 ausgewählt</span>
                </div>
                <div className="grid gap-2">
                  {profiles?.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProfile(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                        data-testid={`settings-profile-${p.id}`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.energyLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Haushaltsgröße</Label>
                  <span className="font-mono text-primary font-bold">{householdSize} Personen</span>
                </div>
                <Slider 
                  value={[householdSize]} 
                  min={1} max={6} step={1} 
                  onValueChange={v => setHouseholdSize(v[0])}
                  className="py-2"
                  data-testid="slider-household-settings"
                />
              </div>

              <div className="space-y-3">
                <Label>Budget-Niveau</Label>
                <RadioGroup value={budgetLevel} onValueChange={setBudgetLevel} className="flex gap-4">
                  {([
                    { value: 'low', label: 'bis 50€ / Woche' },
                    { value: 'medium', label: '50–100€ / Woche' },
                    { value: 'high', label: '100€+ / Woche' },
                  ] as const).map(opt => (
                    <div key={opt.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={opt.value} id={`set-budget-${opt.value}`} data-testid={`radio-set-budget-${opt.value}`} />
                      <Label htmlFor={`set-budget-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Typische Kochzeit (Werktags)</Label>
                <p className="text-xs text-muted-foreground -mt-1">Dein Standard für die KI-Planung. Du kannst einzelne Tage jederzeit anpassen.</p>
                <RadioGroup value={cookTimeLimit.toString()} onValueChange={v => setCookTimeLimit(parseInt(v))} className="flex gap-4">
                  {[15, 30, 60].map(time => (
                    <div key={time} className="flex items-center space-x-2">
                      <RadioGroupItem value={time.toString()} id={`set-time-${time}`} data-testid={`radio-set-time-${time}`} />
                      <Label htmlFor={`set-time-${time}`} className="font-mono cursor-pointer">{time}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button 
                className="w-full h-12 rounded-full" 
                onClick={handleSave} 
                disabled={isSaving || selectedIds.length === 0}
                data-testid="btn-save-settings"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Änderungen speichern
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-2xl flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Mein Essmuster
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Mahlzeit+ lernt aus deinem Feedback und passt Vorschläge an.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingLearn ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : learnProfile ? (
              <div className="space-y-3">
                {learnProfile.insightMessage && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                    {learnProfile.insightMessage}
                  </div>
                )}
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Ø Zubereitungszeit (gemochte Rezepte)</div>
                      <div className="font-medium">
                        {learnProfile.avgPreferredPrepTime !== null && learnProfile.avgPreferredPrepTime !== undefined
                          ? `${learnProfile.avgPreferredPrepTime} Minuten`
                          : "Noch nicht genug Daten"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Utensils className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Mahlzeitkomplexität</div>
                      <div className="font-medium">
                        {COMPLEXITY_LABEL[learnProfile.preferredMealComplexity] ?? learnProfile.preferredMealComplexity}
                      </div>
                    </div>
                  </div>
                  {learnProfile.frequentlyReplacedRecipeIds.length > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                      <TrendingUp className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Häufig abgelehnte Rezepte</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {learnProfile.frequentlyReplacedRecipeIds.map((id: number) => (
                            <Badge key={id} variant="outline" className="text-xs">#{id}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Zuletzt aktualisiert: {new Date(learnProfile.updatedAt).toLocaleDateString("de-DE")}
                </p>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Noch kein Lernprofil. Gib Feedback zu deinen Mahlzeiten, um ein Essmuster zu entwickeln.
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={handleAggregate}
                disabled={aggregate.isPending}
                data-testid="btn-learn-aggregate"
              >
                {aggregate.isPending
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Aktualisieren
              </Button>
              {learnProfile && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleResetLearn}
                  disabled={resetLearn.isPending}
                  data-testid="btn-learn-reset"
                >
                  {resetLearn.isPending
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                  Zurücksetzen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Button 
          variant="ghost" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-12 rounded-full"
          onClick={() => signOut()}
          data-testid="btn-signout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Abmelden
        </Button>
      </main>
    </div>
  );
}
